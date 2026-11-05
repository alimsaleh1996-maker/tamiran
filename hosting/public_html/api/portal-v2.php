<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';
require_once tamiran_private_root().'/v2-core.php';
require_once tamiran_private_root().'/sms-service.php';

function portal_token_encode(string $bytes):string{return rtrim(strtr(base64_encode($bytes),'+/','-_'),'=');}
function portal_find(PDO $pdo,string $token,bool $lock=false):array{$hash=hash('sha256',$token);$statement=$pdo->prepare('SELECT p.*,c.receipt_number,c.declared_issue,c.operation_report,c.device_type_snapshot,c.brand_snapshot,c.model_snapshot,w.process_status,w.workflow_code,cu.full_name AS customer_name,cu.mobile AS customer_mobile FROM repair_portal_tokens p INNER JOIN repair_cases c ON c.id=p.case_id INNER JOIN repair_case_workflows w ON w.case_id=c.id INNER JOIN repair_customers cu ON cu.id=c.customer_id WHERE p.token_hash=:hash AND p.revoked_at IS NULL AND p.expires_at>=NOW() LIMIT 1'.($lock?' FOR UPDATE':''));$statement->execute(['hash'=>$hash]);$row=$statement->fetch();if(!is_array($row))throw new TamiranApiException('لینک پرونده نامعتبر یا منقضی است.',404);return$row;}
function portal_public_payload(PDO $pdo,array $portal):array{$estimate=$pdo->prepare("SELECT public_id,estimate_number,status,diagnostic_fee,subtotal_amount,discount_amount,tax_amount,total_amount,valid_until,customer_note,sent_at,decided_at FROM repair_estimates WHERE case_id=:case AND status NOT IN ('draft','superseded') ORDER BY revision DESC LIMIT 1");$estimate->execute(['case'=>$portal['case_id']]);$invoice=$pdo->prepare("SELECT i.public_id,i.invoice_number,i.status,i.total_amount,i.paid_amount,i.refunded_amount,(i.total_amount-(i.paid_amount-i.refunded_amount)) AS balance,i.issued_at FROM repair_invoices i WHERE i.case_id=:case AND i.status<>'draft' LIMIT 1");$invoice->execute(['case'=>$portal['case_id']]);$warranty=$pdo->prepare('SELECT wa.public_id,wa.starts_at,wa.expires_at,wa.conditions_text,ii.title FROM repair_warranties wa INNER JOIN repair_deliveries d ON d.id=wa.delivery_id INNER JOIN repair_invoice_items ii ON ii.id=wa.invoice_item_id WHERE d.case_id=:case ORDER BY wa.expires_at');$warranty->execute(['case'=>$portal['case_id']]);$messages=$pdo->prepare("SELECT direction,body,created_at,answered_at FROM repair_portal_messages WHERE case_id=:case AND (direction='customer_to_shop' OR status IN ('answered','closed')) ORDER BY created_at DESC LIMIT 100");$messages->execute(['case'=>$portal['case_id']]);return['receiptNumber'=>$portal['receipt_number'],'customerName'=>$portal['customer_name'],'deviceTitle'=>trim($portal['device_type_snapshot'].' '.$portal['brand_snapshot'].' '.$portal['model_snapshot']),'declaredIssue'=>$portal['declared_issue'],'status'=>$portal['process_status'],'workflowCode'=>$portal['workflow_code'],'operationReport'=>$portal['operation_report']??'','estimate'=>$estimate->fetch()?:null,'invoice'=>$invoice->fetch()?:null,'warranties'=>$warranty->fetchAll(),'messages'=>$messages->fetchAll(),'linkExpiresAt'=>$portal['expires_at']];}

function portal_access_case(PDO $pdo,string $receipt,string $mobile):array
{
    $normalizedReceipt=tamiran_digits($receipt);
    $normalizedMobile=tamiran_mobile($mobile);
    if(!preg_match('/^\d{12}$/',$normalizedReceipt))throw new TamiranApiException('شماره پذیرش یا موبایل مطابقت ندارد.',404);
    $statement=$pdo->prepare("SELECT c.id,c.public_id,c.shop_id,c.tracking_token_ciphertext,cu.mobile FROM repair_cases c INNER JOIN repair_customers cu ON cu.id=c.customer_id AND cu.shop_id=c.shop_id WHERE REPLACE(c.public_receipt_no,'-','')=:receipt AND cu.mobile=:mobile LIMIT 1");
    $statement->execute(['receipt'=>$normalizedReceipt,'mobile'=>$normalizedMobile]);
    $row=$statement->fetch();
    if(!is_array($row))throw new TamiranApiException('شماره پذیرش یا موبایل مطابقت ندارد.',404);
    return$row;
}

function portal_access_otp_request(PDO $pdo,array $input):array
{
    $receipt=(string)($input['receiptNumber']??'');
    $mobile=(string)($input['mobile']??'');
    tamiran_public_rate_limit('portal-recovery|'.hash('sha256',tamiran_client_ip().'|'.tamiran_digits($receipt)),5,900,900);
    $case=portal_access_case($pdo,$receipt,$mobile);
    $providerStatement=$pdo->prepare('SELECT * FROM tamiran_sms_providers WHERE shop_id=:shop AND is_active=1 ORDER BY id LIMIT 1');
    $providerStatement->execute(['shop'=>$case['shop_id']]);
    $providerRow=$providerStatement->fetch();
    if(!is_array($providerRow))throw new TamiranApiException('سرویس پیامک این تعمیرگاه فعال نیست.',409);
    $settings=json_decode((string)$providerRow['settings_json'],true)?:[];
    $template=(string)($settings['otpTemplate']??'');
    if($template==='')throw new TamiranApiException('قالب OTP تنظیم نشده است.',409);
    $code=(string)random_int(100000,999999);
    $requestPublic=tamiran_id();
    $pdo->prepare("INSERT INTO tamiran_sms_otps(public_id,shop_id,purpose,subject_public_id,mobile,code_hash,expires_at) VALUES(:public,:shop,'portal_access',:subject,:mobile,:hash,DATE_ADD(NOW(),INTERVAL 3 MINUTE))")->execute([
        'public'=>$requestPublic,'shop'=>$case['shop_id'],'subject'=>$case['public_id'],'mobile'=>$case['mobile'],
        'hash'=>tamiran_sms_otp_hash((int)$case['shop_id'],'portal_access',(string)$case['public_id'],(string)$case['mobile'],$code),
    ]);
    tamiran_sms_provider_from_row($providerRow)->lookup((string)$case['mobile'],$template,[$code]);
    return['requested'=>true,'requestId'=>$requestPublic,'expiresInSeconds'=>180];
}

function portal_access_otp_verify(PDO $pdo,array $input):array
{
    $case=portal_access_case($pdo,(string)($input['receiptNumber']??''),(string)($input['mobile']??''));
    $pdo->beginTransaction();
    try {
        $valid=tamiran_sms_verify_otp($pdo,(int)$case['shop_id'],'portal_access',(string)$case['public_id'],(string)$case['mobile'],(string)($input['requestId']??''),(string)($input['otpCode']??''));
        if(!$valid){
            // Only the OTP attempt counter has been written so far. Preserve
            // it before returning 403; rolling it back defeats max_attempts.
            $pdo->commit();
            throw new TamiranApiException('کد یک‌بارمصرف معتبر نیست.',403);
        }
        if(empty($case['tracking_token_ciphertext']))throw new TamiranApiException('لینک امن این پرونده آماده نیست.',409);
        $token=tamiran_decrypt_secret((string)$case['tracking_token_ciphertext']);
        portal_find($pdo,$token,true);
        $pdo->commit();
        return['verified'=>true,'token'=>$token,'relativeUrl'=>'/?portal='.$token];
    } catch (Throwable $error) {
        if($pdo->inTransaction())$pdo->rollBack();
        throw $error;
    }
}

tamiran_api(static function():array{
    $pdo=tamiran_db();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){$token=(string)($_GET['token']??'');if(strlen($token)<32)throw new TamiranApiException('لینک معتبر نیست.',404);tamiran_public_rate_limit('portal-view|'.hash('sha256',$token),120,3600,300);$portal=portal_find($pdo,$token);$pdo->prepare('UPDATE repair_portal_tokens SET last_viewed_at=NOW() WHERE id=:id')->execute(['id'=>$portal['id']]);$pdo->prepare("INSERT INTO repair_portal_actions(public_id,portal_token_id,action_type,payload_json,ip_address,user_agent) VALUES(:public,:token,'viewed',:payload,:ip,:agent)")->execute(['public'=>tamiran_id(),'token'=>$portal['id'],'payload'=>'{}','ip'=>tamiran_client_ip(),'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,500)]);return portal_public_payload($pdo,$portal);}
    if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);
    $input=tamiran_json_body();
    $action=(string)($input['action']??'');
    if($action==='access_otp_request')return portal_access_otp_request($pdo,$input);
    if($action==='access_otp_verify')return portal_access_otp_verify($pdo,$input);
    if($action==='create_link'){
        $actor=tamiran_require_writable_actor();
        tamiran_require_csrf();
        if(!is_array($actor['shop']??null)||!in_array($actor['role'],['repair_manager','reception'],true))throw new TamiranApiException('ساخت لینک پرونده مجاز نیست.',403);
        $caseId=(int)($input['caseId']??0);
        $statement=$pdo->prepare('SELECT c.public_id,c.tracking_token_hash,c.tracking_token_ciphertext FROM repair_cases c WHERE c.id=:case AND c.shop_id=:shop AND c.branch_id=:branch LIMIT 1');
        $statement->execute(['case'=>$caseId,'shop'=>$actor['shop']['id'],'branch'=>$actor['branch']['id']]);
        $case=$statement->fetch();
        if(!is_array($case))throw new TamiranApiException('پرونده پیدا نشد.',404);
        if(empty($case['tracking_token_hash'])||empty($case['tracking_token_ciphertext']))throw new TamiranApiException('شناسه امن این پرونده آماده نیست.',409);
        $raw=tamiran_decrypt_secret((string)$case['tracking_token_ciphertext']);
        $tokenHash=hash('sha256',$raw);
        if(!hash_equals((string)$case['tracking_token_hash'],$tokenHash))throw new TamiranApiException('یکپارچگی شناسه امن پرونده تأیید نشد.',409);
        $grace=max(0,min(365,(int)($input['graceDays']??30)));
        $warranty=$pdo->prepare('SELECT MAX(wa.expires_at) FROM repair_warranties wa INNER JOIN repair_deliveries d ON d.id=wa.delivery_id WHERE d.case_id=:case');
        $warranty->execute(['case'=>$caseId]);
        $warrantyExpiry=$warranty->fetchColumn();
        $base=is_string($warrantyExpiry)&&strtotime($warrantyExpiry)!==false?max(time(),(int)strtotime($warrantyExpiry)):time()+365*86400;
        $expires=date('Y-m-d H:i:s',$base+$grace*86400);
        $public=tamiran_id();
        $pdo->prepare('INSERT INTO repair_portal_tokens(public_id,shop_id,case_id,token_hash,expires_at,created_by_user_id) VALUES(:public,:shop,:case,:hash,:expires,:actor) ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at),revoked_at=NULL')->execute([
            'public'=>$public,'shop'=>$actor['shop']['id'],'case'=>$caseId,'hash'=>$tokenHash,'expires'=>$expires,'actor'=>$actor['id'],
        ]);
        $tokenRow=$pdo->prepare('SELECT public_id FROM repair_portal_tokens WHERE token_hash=:hash LIMIT 1');
        $tokenRow->execute(['hash'=>$tokenHash]);
        $storedPublic=$tokenRow->fetchColumn();
        return['created'=>true,'publicId'=>is_string($storedPublic)?$storedPublic:$public,'token'=>$raw,'relativeUrl'=>'/?portal='.$raw,'expiresAt'=>$expires];
    }
    $token=(string)($input['token']??'');if(strlen($token)<32)throw new TamiranApiException('لینک معتبر نیست.',404);tamiran_public_rate_limit('portal-action|'.hash('sha256',$token),30,3600,900);$portal=portal_find($pdo,$token,true);
    if($action==='message'){$body=trim((string)($input['body']??''));if($body===''||mb_strlen($body)>4000)throw new TamiranApiException('متن پیام معتبر نیست.');$public=tamiran_id();$pdo->prepare("INSERT INTO repair_portal_messages(public_id,shop_id,case_id,direction,body,status) VALUES(:public,:shop,:case,'customer_to_shop',:body,'new')")->execute(['public'=>$public,'shop'=>$portal['shop_id'],'case'=>$portal['case_id'],'body'=>$body]);$pdo->prepare("INSERT INTO repair_portal_actions(public_id,portal_token_id,action_type,subject_public_id,payload_json,ip_address,user_agent) VALUES(:public,:token,'message_sent',:subject,:payload,:ip,:agent)")->execute(['public'=>tamiran_id(),'token'=>$portal['id'],'subject'=>$public,'payload'=>'{}','ip'=>tamiran_client_ip(),'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,500)]);return['sent'=>true];}
    if($action==='otp_request'){$purpose=(string)($input['purpose']??'portal_action');if(!in_array($purpose,['estimate','portal_action'],true))throw new TamiranApiException('هدف OTP معتبر نیست.');$subject=v2_text($input['subjectPublicId']??'','موضوع',80);$providerStatement=$pdo->prepare('SELECT * FROM tamiran_sms_providers WHERE shop_id=:shop AND is_active=1 ORDER BY id LIMIT 1');$providerStatement->execute(['shop'=>$portal['shop_id']]);$providerRow=$providerStatement->fetch();if(!is_array($providerRow))throw new TamiranApiException('سرویس پیامک فعال نیست.',409);$settings=json_decode((string)$providerRow['settings_json'],true)?:[];$template=(string)($settings['otpTemplate']??'');if($template==='')throw new TamiranApiException('قالب OTP تنظیم نشده است.',409);$code=(string)random_int(100000,999999);$requestPublic=tamiran_id();$mobile=tamiran_mobile($portal['customer_mobile']);$pdo->prepare('INSERT INTO tamiran_sms_otps(public_id,shop_id,purpose,subject_public_id,mobile,code_hash,expires_at) VALUES(:public,:shop,:purpose,:subject,:mobile,:hash,DATE_ADD(NOW(),INTERVAL 3 MINUTE))')->execute(['public'=>$requestPublic,'shop'=>$portal['shop_id'],'purpose'=>$purpose,'subject'=>$subject,'mobile'=>$mobile,'hash'=>tamiran_sms_otp_hash((int)$portal['shop_id'],$purpose,$subject,$mobile,$code)]);$provider=tamiran_sms_provider_from_row($providerRow);$provider->lookup($mobile,$template,[$code]);return['requested'=>true,'requestId'=>$requestPublic,'expiresInSeconds'=>180];}
    if($action==='estimate_decide'){
        $estimatePublic=v2_text($input['estimatePublicId']??'','برآورد',80);
        $decision=(string)($input['decision']??'');
        if(!in_array($decision,['approved','rejected','explanation_requested'],true))throw new TamiranApiException('تصمیم معتبر نیست.');
        $pdo->beginTransaction();
        try {
            if(!tamiran_sms_verify_otp($pdo,(int)$portal['shop_id'],'estimate',$estimatePublic,tamiran_mobile($portal['customer_mobile']),(string)($input['otpRequestId']??''),(string)($input['otpCode']??''))){
                // No business state has changed yet; retain failed attempts.
                $pdo->commit();
                throw new TamiranApiException('OTP معتبر نیست.',403);
            }
            $estimate=$pdo->prepare("SELECT id,status FROM repair_estimates WHERE public_id=:public AND shop_id=:shop AND case_id=:case AND status IN ('sent','explanation_requested') FOR UPDATE");
            $estimate->execute(['public'=>$estimatePublic,'shop'=>$portal['shop_id'],'case'=>$portal['case_id']]);
            $row=$estimate->fetch();
            if(!is_array($row))throw new TamiranApiException('برآورد قابل تصمیم نیست.',409);
            $pdo->prepare('UPDATE repair_estimates SET status=:decision,decided_at=NOW() WHERE id=:id')->execute(['decision'=>$decision,'id'=>$row['id']]);
            $pdo->prepare("INSERT INTO repair_estimate_approvals(public_id,estimate_id,decision,channel,customer_mobile,otp_request_id,recorded_by_user_id,decision_reason,evidence_json) VALUES(:public,:estimate,:decision,'secure_portal',:mobile,:otp,NULL,:reason,:evidence)")->execute(['public'=>tamiran_id(),'estimate'=>$row['id'],'decision'=>$decision,'mobile'=>$portal['customer_mobile'],'otp'=>$input['otpRequestId'],'reason'=>v2_text($input['reason']??'','علت',1000,false),'evidence'=>'{}']);
            $pdo->prepare('INSERT INTO repair_portal_actions(public_id,portal_token_id,action_type,subject_public_id,otp_request_id,payload_json,ip_address,user_agent) VALUES(:public,:token,:action,:subject,:otp,:payload,:ip,:agent)')->execute(['public'=>tamiran_id(),'token'=>$portal['id'],'action'=>$decision==='approved'?'estimate_approved':($decision==='rejected'?'estimate_rejected':'explanation_requested'),'subject'=>$estimatePublic,'otp'=>$input['otpRequestId'],'payload'=>json_encode(['reason'=>$input['reason']??null],JSON_UNESCAPED_UNICODE),'ip'=>tamiran_client_ip(),'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,500)]);
            $pdo->commit();
            return['decided'=>true,'decision'=>$decision];
        } catch (Throwable $error) {
            if($pdo->inTransaction())$pdo->rollBack();
            throw $error;
        }
    }
    throw new TamiranApiException('عملیات پرتال معتبر نیست.');
});
