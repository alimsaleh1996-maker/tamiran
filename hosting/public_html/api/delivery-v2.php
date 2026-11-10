<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';
require_once tamiran_private_root().'/v2-core.php';
require_once tamiran_private_root().'/capability-service.php';
$smsService=tamiran_private_root().'/sms-service.php';if(is_file($smsService))require_once$smsService;

function delivery_payload(PDO $pdo,array $scope):array
{
    v2_require_permission($scope,'delivery.view',['reception','finance_cashier'],'مشاهده صف تحویل مجاز نیست.');$statement=$pdo->prepare("SELECT w.*,c.public_id AS case_public_id,c.receipt_number,c.accessories_json,c.customer_id,c.product_profile_snapshot,c.inventory_mode_snapshot,c.qc_mode_snapshot,c.feature_flags_snapshot_json,cu.full_name AS customer_name,cu.mobile AS customer_mobile,i.public_id AS invoice_public_id,i.invoice_number,i.total_amount,i.paid_amount,i.refunded_amount,(SELECT COUNT(*) FROM repair_warranties wa INNER JOIN repair_deliveries wd ON wd.id=wa.delivery_id WHERE wd.case_id=c.id AND wa.expires_at>=NOW()) AS active_warranty_count FROM repair_case_workflows w INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN repair_customers cu ON cu.id=c.customer_id LEFT JOIN repair_invoices i ON i.case_id=c.id WHERE w.shop_id=:shop AND w.branch_id=:branch AND w.process_status IN ('finance_pending','ready_for_delivery','delivered') ORDER BY w.updated_at DESC LIMIT 500");$statement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$cases=$statement->fetchAll();foreach($cases as&$case){$case['blockers']=v2_case_blockers($pdo,$scope,$case);$case['balance']=$case['invoice_public_id']===null?null:(int)$case['total_amount']-((int)$case['paid_amount']-(int)$case['refunded_amount']);$case['active_warranty_count']=(int)$case['active_warranty_count'];}unset($case);$setting=$pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='delivery_verification' LIMIT 1");$setting->execute(['shop'=>$scope['shop_id']]);$json=$setting->fetchColumn();$settings=is_string($json)?json_decode($json,true):null;if(!is_array($settings))$settings=['enabledMethods'=>['digital_signature','identity_document','sms_otp','receipt_qr'],'minimumEvidenceCount'=>1];$warranty=tamiran_capability_find(tamiran_capability_snapshot($pdo,$scope['actor']),'warranty');return['cases'=>$cases,'verificationSettings'=>$settings,'warrantyEnabled'=>is_array($warranty)&&($warranty['access']??'')==='granted'];
}


function delivery_complete(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'delivery.complete',['reception'],'تحویل دستگاه برای نقش فعلی مجاز نیست.');
    $caseId=(int)($input['caseId']??0);
    $idempotency=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه یکتای تحویل',160);
    $recipientType=(string)($input['recipientType']??'customer');
    $method=(string)($input['verificationMethod']??'');
    if(!in_array($recipientType,['customer','representative'],true)||!in_array($method,['digital_signature','identity_document','sms_otp','receipt_qr','manager_emergency'],true)){
        throw new TamiranApiException('نوع تحویل‌گیرنده یا روش احراز معتبر نیست.',422);
    }
    $recipientName=v2_text($input['recipientFullName']??'','نام تحویل‌گیرنده',180);
    $recipientMobile=tamiran_mobile((string)($input['recipientMobile']??''));
    $evidence=is_array($input['verificationEvidence']??null)?$input['verificationEvidence']:[];
    $confirmed=is_array($input['accessoriesConfirmed']??null)?$input['accessoriesConfirmed']:[];

    $replayed=v2_delivery_replay($pdo,$scope,$caseId,$idempotency);
    if($replayed!==null)return $replayed;

    $pdo->beginTransaction();
    try{
        $case=v2_case($pdo,$scope,$caseId,true);
        if($case['process_status']!=='ready_for_delivery'||$case['locked_at']!==null){
            throw new TamiranApiException('پرونده آماده تحویل نیست یا قبلاً تحویل شده است.',409);
        }
        $duplicate=$pdo->prepare('SELECT public_id FROM repair_deliveries WHERE case_id=:case FOR UPDATE');
        $duplicate->execute(['case'=>$caseId]);
        if($duplicate->fetchColumn()!==false)throw new TamiranApiException('تحویل این پرونده قبلاً ثبت شده است.',409);

        $blockers=v2_case_blockers($pdo,$scope,$case);
        $allBlockers=array_merge($blockers['parts'],$blockers['qc'],$blockers['finance']);
        if($allBlockers!==[])throw new TamiranApiException('پرونده شرایط تحویل ندارد: '.implode('، ',$allBlockers),409);

        $expectedRaw=json_decode((string)($case['accessories_json']??'[]'),true);
        $expected=is_array($expectedRaw)?$expectedRaw:[];
        $label=static function(mixed $item):string{
            if(is_string($item))return trim($item);
            if(is_array($item))return trim((string)($item['label']??$item['title']??$item['name']??''));
            return'';
        };
        $expectedLabels=array_values(array_unique(array_filter(array_map($label,$expected))));
        $confirmedLabels=array_values(array_unique(array_filter(array_map($label,$confirmed))));
        $missing=array_values(array_diff($expectedLabels,$confirmedLabels));
        if($missing!==[])throw new TamiranApiException('تأیید لوازم همراه کامل نیست: '.implode('، ',$missing),409);

        $invoice=$pdo->prepare("SELECT * FROM repair_invoices WHERE case_id=:case AND status IN ('issued','partially_paid','paid') FOR UPDATE");
        $invoice->execute(['case'=>$caseId]);
        $invoiceRow=$invoice->fetch();
        if(!is_array($invoiceRow))throw new TamiranApiException('فاکتور نهایی پیدا نشد.',409);

        $customerMobile=tamiran_mobile((string)$case['customer_mobile']);
        $setting=$pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='delivery_verification'");
        $setting->execute(['shop'=>$scope['shop_id']]);
        $settingJson=$setting->fetchColumn();
        $settings=is_string($settingJson)?json_decode($settingJson,true):null;
        if(!is_array($settings))$settings=['enabledMethods'=>['digital_signature','identity_document','sms_otp','receipt_qr'],'minimumEvidenceCount'=>1];
        $enabled=(array)($settings['enabledMethods']??[]);
        if($enabled===[])throw new TamiranApiException('حداقل یک روش احراز تحویل باید در تنظیمات فعال باشد.',409);
        if($method!=='manager_emergency'&&!in_array($method,$enabled,true))throw new TamiranApiException('این روش احراز در تنظیمات فعال نیست.',409);
        $minimum=max(1,(int)($settings['minimumEvidenceCount']??1));
        if(count(array_filter($evidence,static fn($value):bool=>$value!==null&&$value!==''&&$value!==false))<$minimum){
            throw new TamiranApiException('حداقل مدارک احراز تحویل تکمیل نشده است.',409);
        }

        $otpRequest=(string)($input['otpRequestId']??'');
        $otpCode=(string)($input['otpCode']??'');
        $national=v2_text($input['recipientNationalCode']??'','کد هویتی',20,false);
        if($recipientType==='representative'){
            $national=v2_text($input['recipientNationalCode']??'','مشخصات هویتی تحویل‌گیرنده',20);
            if(!function_exists('tamiran_sms_verify_otp')||!tamiran_sms_verify_otp($pdo,$scope['shop_id'],'representative_delivery',(string)$case['case_public_id'],$customerMobile,$otpRequest,$otpCode)){
                // No delivery record has been inserted. Commit only failed
                // OTP attempts so a 403 cannot reset the attempt limit.
                $pdo->commit();
                throw new TamiranApiException('تحویل به شخص دیگر فقط با OTP مشتری و مشخصات کامل تحویل‌گیرنده مجاز است.',403);
            }
        }elseif($method==='sms_otp'){
            if(!function_exists('tamiran_sms_verify_otp')||!tamiran_sms_verify_otp($pdo,$scope['shop_id'],'delivery',(string)$case['case_public_id'],$customerMobile,$otpRequest,$otpCode)){
                $pdo->commit();
                throw new TamiranApiException('کد یک‌بارمصرف تحویل معتبر نیست.',403);
            }
        }elseif($method==='manager_emergency'){
            if(!in_array($scope['role'],['repair_manager','owner','central_admin'],true))throw new TamiranApiException('مسیر اضطراری فقط برای مدیر مجاز است.',403);
            $evidence['emergencyReason']=v2_text($input['emergencyReason']??'','علت مسیر اضطراری',1000);
            if(count($evidence)<2)throw new TamiranApiException('در مسیر اضطراری حداقل دو مدرک جایگزین لازم است.',409);
        }

        $deliveryPublic=tamiran_id();
        $hadSecret=!empty($case['temporary_device_secret_ciphertext']);
        $pdo->prepare('INSERT INTO repair_deliveries(public_id,shop_id,case_id,invoice_id,recipient_type,recipient_full_name,recipient_national_code,recipient_mobile,verification_method,verification_json,customer_otp_request_id,accessories_confirmed_json,warnings_acknowledged_json,delivered_by_user_id,idempotency_key) VALUES(:public,:shop,:case,:invoice,:recipient_type,:name,:national,:mobile,:method,:verification,:otp,:accessories,:warnings,:actor,:idempotency)')->execute([
            'public'=>$deliveryPublic,'shop'=>$scope['shop_id'],'case'=>$caseId,'invoice'=>$invoiceRow['id'],'recipient_type'=>$recipientType,
            'name'=>$recipientName,'national'=>$national,'mobile'=>$recipientMobile,'method'=>$method,'verification'=>v2_json($evidence),
            'otp'=>$otpRequest?:null,'accessories'=>v2_json($confirmedLabels),'warnings'=>v2_json($input['warningsAcknowledged']??[]),
            'actor'=>$scope['actor']['id'],'idempotency'=>$idempotency,
        ]);
        $deliveryId=(int)$pdo->lastInsertId();

        $warrantyItems=$pdo->prepare('SELECT id,warranty_days FROM repair_invoice_items WHERE invoice_id=:invoice AND warranty_days>0');
        $warrantyItems->execute(['invoice'=>$invoiceRow['id']]);
        $insertWarranty=$pdo->prepare('INSERT INTO repair_warranties(public_id,delivery_id,invoice_item_id,starts_at,expires_at,conditions_text) VALUES(:public,:delivery,:item,NOW(),:expires,:conditions)');
        foreach($warrantyItems->fetchAll()as$item){
            $insertWarranty->execute(['public'=>tamiran_id(),'delivery'=>$deliveryId,'item'=>$item['id'],'expires'=>date('Y-m-d H:i:s',time()+(int)$item['warranty_days']*86400),'conditions'=>v2_text($input['warrantyConditions']??'ضمانت مطابق شرایط درج‌شده در فاکتور است.','شرایط ضمانت',4000)]);
        }
        $pdo->prepare("UPDATE repair_case_workflows SET process_status='delivered',locked_at=NOW(),temporary_device_secret_ciphertext=NULL,temporary_secret_deleted_at=NOW(),lock_version=lock_version+1 WHERE id=:id")->execute(['id'=>$case['id']]);
        $pdo->prepare("UPDATE repair_cases SET status='delivered',delivery_amount=:amount,delivered_to_name=:name,delivered_by_user_id=:actor,delivered_at=NOW(),row_version=row_version+1 WHERE id=:case")->execute(['amount'=>(int)$invoiceRow['total_amount'],'name'=>$recipientName,'actor'=>$scope['actor']['id'],'case'=>$caseId]);
        $pdo->prepare('UPDATE repair_invoices SET locked_at=NOW() WHERE id=:invoice')->execute(['invoice'=>$invoiceRow['id']]);
        $pdo->prepare('UPDATE repair_case_stage_events SET ended_at=NOW() WHERE workflow_id=:workflow AND ended_at IS NULL')->execute(['workflow'=>$case['id']]);
        $pdo->prepare("INSERT INTO repair_case_stage_events(public_id,workflow_id,from_status,to_status,actor_user_id,reason,metadata_json,idempotency_key,started_at,ended_at) VALUES(:public,:workflow,'ready_for_delivery','delivered',:actor,'تحویل امن دستگاه',:metadata,:idempotency,NOW(),NOW())")->execute(['public'=>tamiran_id(),'workflow'=>$case['id'],'actor'=>$scope['actor']['id'],'metadata'=>v2_json(['deliveryPublicId'=>$deliveryPublic,'method'=>$method]),'idempotency'=>'delivery:'.$idempotency]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'delivery.complete','repair_delivery',$deliveryPublic,null,['case'=>$case['case_public_id'],'recipientType'=>$recipientType,'method'=>$method,'idempotencyKey'=>$idempotency],'تحویل نهایی و شروع ضمانت');
        if($hadSecret)tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'DEVICE_SECRET_DELETED','repair_case',(string)$case['case_public_id'],null,['reason'=>'delivery_completed']);
        $pdo->commit();
    }catch(Throwable$error){
        if($pdo->inTransaction())$pdo->rollBack();
        if($error instanceof PDOException&&str_contains(strtolower($error->getMessage()),'duplicate')){
            $replayed=v2_delivery_replay($pdo,$scope,$caseId,$idempotency);
            if($replayed!==null)return $replayed;
            throw new TamiranApiException('شناسه یکتای تحویل یا تحویل پرونده قبلاً ثبت شده است.',409);
        }
        throw$error;
    }
    return['delivered'=>true,'replayed'=>false,'publicId'=>$deliveryPublic,'receiptNumber'=>$case['receipt_number']];
}

function delivery_report_discrepancy(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'delivery.complete',['reception'],'ثبت مغایرت لوازم برای نقش فعلی مجاز نیست.');
    $caseId=(int)($input['caseId']??0);
    $note=v2_text($input['note']??'','شرح مغایرت لوازم',1000);
    $missing=is_array($input['missingAccessories']??null)?array_values(array_filter(array_map(static fn(mixed $value):string=>trim((string)$value),$input['missingAccessories']))):[];
    if($missing===[])throw new TamiranApiException('حداقل یک قلم مغایرت باید مشخص شود.',422);
    $case=v2_case($pdo,$scope,$caseId);
    $public=tamiran_id();
    tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'delivery.accessories_discrepancy','repair_case',(string)$case['case_public_id'],null,['discrepancyId'=>$public,'missingAccessories'=>$missing,'note'=>$note]);
    return['recorded'=>true,'publicId'=>$public,'missingAccessories'=>$missing];
}


function delivery_warranty_case(PDO $pdo,array $scope,array $input):array
{
    tamiran_capability_require($pdo,$scope['actor'],'warranty','ماژول گارانتی برای این تعمیرگاه فعال نیست.');
    v2_require_permission($scope,'warranty.case.create',['reception'],'ثبت مراجعه ضمانتی مجاز نیست.');
    $originalId=(int)($input['originalCaseId']??0);
    $issue=v2_text($input['declaredIssue']??'','شرح مراجعه ضمانتی',4000);
    $idempotency=v2_text($input['idempotencyKey']??('warranty:'.$originalId.':'.tamiran_request_id()),'شناسه یکتا',160);
    $existing=$pdo->prepare('SELECT id,receipt_number,public_id FROM repair_cases WHERE shop_id=:shop AND idempotency_key=:key LIMIT 1');
    $existing->execute(['shop'=>$scope['shop_id'],'key'=>$idempotency]);
    $replayed=$existing->fetch();
    if(is_array($replayed))return['created'=>false,'replayed'=>true,'caseId'=>(int)$replayed['id'],'publicId'=>$replayed['public_id'],'receiptNumber'=>$replayed['receipt_number']];

    $pdo->beginTransaction();
    try{
        $originalStatement=$pdo->prepare("SELECT c.*,w.workflow_code,cu.full_name AS customer_name FROM repair_cases c INNER JOIN repair_case_workflows w ON w.case_id=c.id INNER JOIN repair_customers cu ON cu.id=c.customer_id AND cu.shop_id=c.shop_id WHERE c.id=:case AND c.shop_id=:shop AND c.branch_id=:branch AND w.process_status='delivered' FOR UPDATE");
        $originalStatement->execute(['case'=>$originalId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
        $original=$originalStatement->fetch();
        if(!is_array($original))throw new TamiranApiException('پرونده تحویل‌شده اصلی پیدا نشد.',404);
        $valid=$pdo->prepare('SELECT COUNT(*) FROM repair_warranties wa INNER JOIN repair_deliveries d ON d.id=wa.delivery_id WHERE d.case_id=:case AND wa.expires_at>=NOW()');
        $valid->execute(['case'=>$originalId]);
        if((int)$valid->fetchColumn()<1)throw new TamiranApiException('ضمانت فعالی برای پرونده اصلی ثبت نشده است.',409);

        $counter=$pdo->prepare('SELECT public_shop_code,receipt_counter FROM repair_shops WHERE id=:shop FOR UPDATE');
        $counter->execute(['shop'=>$scope['shop_id']]);
        $counterRow=$counter->fetch();
        if(!is_array($counterRow)||!preg_match('/^\d{6}$/',(string)$counterRow['public_shop_code']))throw new TamiranApiException('کد عمومی شش‌رقمی تعمیرگاه آماده نیست.',503);
        $next=(int)$counterRow['receipt_counter']+1;
        $pdo->prepare('UPDATE repair_shops SET receipt_counter=:number WHERE id=:shop')->execute(['number'=>$next,'shop'=>$scope['shop_id']]);
        $receipt=(string)$counterRow['public_shop_code'].'-'.str_pad((string)$next,6,'0',STR_PAD_LEFT);
        $trackingToken=tamiran_tracking_token();
        $trackingHash=hash('sha256',$trackingToken);
        $warrantyStatus=(string)$original['product_profile_snapshot']==='solo'?'diagnosing':'awaiting_assignment';
        $casePublic=tamiran_id();
        $pdo->prepare("INSERT INTO repair_cases(public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,public_receipt_no,receipt_number,tracking_token_hash,tracking_token_ciphertext,product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,feature_flags_snapshot_json,idempotency_key,device_type_snapshot,brand_snapshot,model_snapshot,color_snapshot,identifier_snapshot,declared_issue,accessories_json,appearance_states_json,reception_notes,status,created_by_user_id) VALUES(:public,:uuid,:shop,:branch,:customer,:device,:sequence,:public_receipt,:receipt,:tracking_hash,:tracking_ciphertext,:product_profile,:inventory_mode,:qc_mode,:feature_flags,:idempotency,:type,:brand,:model,:color,:identifier,:issue,:accessories,:appearance,:notes,:status,:actor)")->execute([
            'public'=>$casePublic,'uuid'=>tamiran_uuid_v7(),'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'customer'=>$original['customer_id'],'device'=>$original['device_id'],
            'sequence'=>$next,'public_receipt'=>$receipt,'receipt'=>$receipt,'tracking_hash'=>$trackingHash,'tracking_ciphertext'=>tamiran_encrypt_secret($trackingToken),
            'product_profile'=>$original['product_profile_snapshot'],'inventory_mode'=>$original['inventory_mode_snapshot'],'qc_mode'=>$original['qc_mode_snapshot'],'feature_flags'=>$original['feature_flags_snapshot_json'],
            'idempotency'=>$idempotency,'type'=>$original['device_type_snapshot'],'brand'=>$original['brand_snapshot'],'model'=>$original['model_snapshot'],'color'=>$original['color_snapshot']??null,'identifier'=>$original['identifier_snapshot'],
            'issue'=>$issue,'accessories'=>$original['accessories_json'],'appearance'=>v2_json($input['appearanceStates']??[]),'notes'=>v2_text($input['notes']??'','یادداشت داخلی',4000,false),'status'=>$warrantyStatus,'actor'=>$scope['actor']['id'],
        ]);
        $caseId=(int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO repair_portal_tokens(public_id,shop_id,case_id,token_hash,expires_at,created_by_user_id) VALUES(:public,:shop,:case,:hash,DATE_ADD(NOW(),INTERVAL 400 DAY),:actor)")->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'case'=>$caseId,'hash'=>$trackingHash,'actor'=>$scope['actor']['id']]);
        $term=$pdo->prepare('SELECT id,title,content_sha256 FROM repair_receipt_term_versions WHERE shop_id=:shop AND is_active=1 AND effective_from<=NOW() AND (effective_to IS NULL OR effective_to>NOW()) ORDER BY version_number DESC LIMIT 1');
        $term->execute(['shop'=>$scope['shop_id']]);
        $termRow=$term->fetch();
        if(!is_array($termRow))throw new TamiranApiException('نسخه فعال شرایط پذیرش تنظیم نشده است.',409);
        $pdo->prepare("INSERT INTO repair_case_receipt_terms(public_id,case_id,term_version_id,accepted_by_name,acceptance_method,evidence_json) VALUES(:public,:case,:term,:name,'recorded_consent',:evidence)")->execute(['public'=>tamiran_id(),'case'=>$caseId,'term'=>$termRow['id'],'name'=>$original['customer_name'],'evidence'=>v2_json(['termTitle'=>$termRow['title'],'contentSha256'=>$termRow['content_sha256']])]);
        $workflowPublic=tamiran_id();
        $pdo->prepare("INSERT INTO repair_case_workflows(public_id,shop_id,branch_id,case_id,case_kind,parent_case_id,workflow_code,process_status,diagnostic_fee_policy_json,customer_consent_json) VALUES(:public,:shop,:branch,:case,'warranty_return',:parent,:workflow,:status,:diagnostic,:consent)")->execute(['public'=>$workflowPublic,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId,'parent'=>$originalId,'workflow'=>$original['workflow_code'],'status'=>$warrantyStatus,'diagnostic'=>v2_json(['source'=>'warranty_policy']),'consent'=>v2_json(['termsAccepted'=>true,'dataHandling'=>'coordinate_first'])]);
        $workflowId=(int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO repair_case_stage_events(public_id,workflow_id,from_status,to_status,actor_user_id,reason,metadata_json,idempotency_key,started_at) VALUES(:public,:workflow,NULL,:status,:actor,'مراجعه ضمانتی مرتبط',:metadata,:idempotency,NOW())")->execute(['public'=>tamiran_id(),'workflow'=>$workflowId,'status'=>$warrantyStatus,'actor'=>$scope['actor']['id'],'metadata'=>v2_json(['originalCaseId'=>$originalId]),'idempotency'=>'warranty:'.$casePublic]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'warranty.case.create','repair_case',$casePublic,null,['originalCaseId'=>$originalId,'receipt'=>$receipt]);
        $pdo->commit();
    }catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
    return['created'=>true,'caseId'=>$caseId,'publicId'=>$casePublic,'receiptNumber'=>$receipt,'trackingUrl'=>'/?portal='.$trackingToken];
}

tamiran_api(static function():array{$pdo=tamiran_db();$scope=v2_scope();$method=$_SERVER['REQUEST_METHOD']??'GET';if($method==='GET')return delivery_payload($pdo,$scope);if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);tamiran_require_csrf();$input=tamiran_json_body();return match((string)($input['action']??'')){'complete'=>delivery_complete($pdo,$scope,$input),'report_discrepancy'=>delivery_report_discrepancy($pdo,$scope,$input),'warranty_case'=>delivery_warranty_case($pdo,$scope,$input),default=>throw new TamiranApiException('عملیات تحویل یا ضمانت معتبر نیست.'),};});
