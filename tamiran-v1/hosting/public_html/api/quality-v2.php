<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';
require_once tamiran_private_root().'/v2-core.php';
$smsService=tamiran_private_root().'/sms-service.php';if(is_file($smsService))require_once$smsService;

function quality_template(PDO $pdo,array $scope,string $code):array
{
    $query=$pdo->prepare('SELECT * FROM repair_qc_templates WHERE shop_id=:shop AND workflow_code=:code AND is_active=1 ORDER BY id DESC LIMIT 1');
    $query->execute(['shop'=>$scope['shop_id'],'code'=>$code]);
    $template=$query->fetch();
    if (!is_array($template)) throw new TamiranApiException('چک‌لیست فعال این صنف پیدا نشد.',409);
    $items=$pdo->prepare('SELECT * FROM repair_qc_template_items WHERE template_id=:template ORDER BY sort_order,id');
    $items->execute(['template'=>$template['id']]);
    return $template+['items'=>$items->fetchAll()];
}

function quality_payload(PDO $pdo,array $scope):array
{
    v2_require_permission($scope,'qc.view',['quality_control','technician'],'مشاهده کنترل کیفیت مجاز نیست.');
    $templates=[];
    foreach (['mobile_tablet','computer_laptop'] as $code) $templates[]=quality_template($pdo,$scope,$code);
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']];
    $extra='';
    if ($scope['role']==='technician') {
        $extra='AND (q.repaired_by_user_id=:actor OR q.performed_by_user_id=:actor2)';
        $params['actor']=$params['actor2']=$scope['actor']['id'];
    }
    $runs=$pdo->prepare("SELECT q.*,c.receipt_number,u.display_name AS performer_name
        FROM repair_qc_runs q JOIN repair_cases c ON c.id=q.case_id JOIN tamiran_users u ON u.id=q.performed_by_user_id
        WHERE q.shop_id=:shop AND c.branch_id=:branch $extra ORDER BY q.completed_at DESC LIMIT 500");
    $runs->execute($params);
    return ['templates'=>$templates,'runs'=>$runs->fetchAll()];
}

function quality_replace_template(PDO $pdo,array $scope,array $template,array $items):array
{
    $pdo->prepare('UPDATE repair_qc_templates SET is_active=0 WHERE shop_id=:shop AND workflow_code=:code')
        ->execute(['shop'=>$scope['shop_id'],'code'=>$template['workflow_code']]);
    $pdo->prepare("INSERT INTO repair_qc_templates(public_id,shop_id,workflow_code,title,source,is_active,created_by_user_id)
        VALUES(:public,:shop,:code,:title,'shop_extension',1,:actor)")
        ->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'code'=>$template['workflow_code'],'title'=>$template['title'],'actor'=>$scope['actor']['id']]);
    $id=(int)$pdo->lastInsertId();
    $insert=$pdo->prepare("INSERT INTO repair_qc_template_items(template_id,code,title,input_type,is_required,requires_evidence_on_fail,sort_order)
        VALUES(:template,:code,:title,'pass_fail',:required,1,:position)");
    foreach ($items as $position=>$item) {
        $insert->execute(['template'=>$id,'code'=>$item['code'],'title'=>$item['title'],'required'=>!empty($item['is_required'])?1:0,'position'=>$position]);
    }
    return quality_template($pdo,$scope,$template['workflow_code']);
}

function quality_save_template(PDO $pdo,array $scope,array $input):array
{
    if ($scope['role']!=='repair_manager') throw new TamiranApiException('تغییر آزمایش‌ها فقط برای مدیر مجاز است.',403);
    $code=(string)($input['workflowCode']??'');
    $lines=$input['items']??null;
    if (!in_array($code,['mobile_tablet','computer_laptop'],true)||!is_array($lines)||count($lines)>100) {
        throw new TamiranApiException('چک‌لیست کنترل کیفیت معتبر نیست.');
    }
    $items=[['code'=>'repair_issue','title'=>'آیا ایراد اصلی دستگاه برطرف شده است؟','is_required'=>true]];
    $seen=['repair_issue'=>true];
    foreach ($lines as $line) {
        if (!is_array($line)) throw new TamiranApiException('ساختار ردیف آزمایش معتبر نیست.');
        $id=$line['code']??'';
        if (!is_string($id)||!preg_match('/^[a-z0-9_-]{1,80}$/D',$id)||isset($seen[$id])) {
            throw new TamiranApiException('شناسه آزمایش باید معتبر و یکتا باشد.');
        }
        $seen[$id]=true;
        $items[]=['code'=>$id,'title'=>v2_text($line['title']??'','عنوان آزمایش',240),'is_required'=>!empty($line['isRequired'])];
    }
    $pdo->beginTransaction();
    try {
        $pdo->prepare('SELECT id FROM repair_shops WHERE id=:shop FOR UPDATE')->execute(['shop'=>$scope['shop_id']]);
        $template=quality_template($pdo,$scope,$code);
        if ((int)$template['id']!==(int)($input['templateId']??0)) throw new TamiranApiException('چک‌لیست تغییر کرده است؛ تازه‌سازی کنید.',409);
        $saved=quality_replace_template($pdo,$scope,$template,$items);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'qc.template.replace','repair_qc_template',$saved['public_id'],
            ['previousId'=>$template['id']],['templateId'=>$saved['id'],'itemCount'=>count($items)]);
        $pdo->commit();
        return ['template'=>$saved];
    } catch(Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function quality_authorize_case(PDO $pdo,array $scope,array $case):void
{
    v2_require_permission($scope,'qc.perform',['quality_control','technician'],'ثبت QC برای نقش فعلی مجاز نیست.');
    $id=(int)$scope['actor']['id'];
    $self=(int)$case['primary_technician_user_id']===$id || ((int)$case['primary_technician_user_id']===0&&$scope['role']==='repair_manager'&&$case['product_profile_snapshot']==='solo');
    $policy=v2_product_policy($pdo,$scope,$case);
    if (!$policy['qcEnabled']) throw new TamiranApiException('کنترل کیفیت برای این پرونده فعال نیست.',409);
    if ($policy['qcMode']==='independent') {
        $contributors=$pdo->prepare("SELECT 1 FROM repair_case_events WHERE case_id=:case AND actor_user_id=:actor AND event_type IN ('technical_activity','technical_finish') LIMIT 1");
        $contributors->execute(['case'=>$case['case_id'],'actor'=>$id]);
        if ($self||$contributors->fetchColumn()!==false) throw new TamiranApiException('کنترل کیفیت مستقل باید توسط فردی غیر از تعمیرکار انجام شود.',403);
        if ($scope['role']==='technician'&&!in_array('qc.perform',$scope['permissions'],true)) throw new TamiranApiException('دسترسی کنترل کیفیت مستقل ندارید.',403);
    } elseif (!$self) {
        throw new TamiranApiException('خودکنترلی فقط توسط تعمیرکار مسئول مجاز است.',403);
    }
}

function quality_receipt(PDO $pdo,array $case):array|null
{
    $current=$pdo->prepare("SELECT id FROM repair_case_stage_events WHERE workflow_id=:workflow AND to_status='qc_pending' ORDER BY id DESC LIMIT 1");
    $current->execute(['workflow'=>$case['id']]);
    $stage=(int)$current->fetchColumn();
    $snapshot=$pdo->prepare("SELECT metadata_json FROM repair_case_events WHERE case_id=:case AND event_type='quality_received'
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.stageId'))=:stage ORDER BY id DESC LIMIT 1");
    $snapshot->execute(['case'=>$case['case_id'],'stage'=>$stage]);
    $value=json_decode((string)$snapshot->fetchColumn(),true);
    return is_array($value)?$value:null;
}

function quality_start(PDO $pdo,array $scope,array $input):array
{
    $pdo->beginTransaction();
    try {
        $case=v2_case($pdo,$scope,(int)($input['caseId']??0),true);
        quality_authorize_case($pdo,$scope,$case);
        if ($case['process_status']!=='qc_pending') throw new TamiranApiException('پرونده در صف کنترل کیفیت نیست.',409);
        if ($saved=quality_receipt($pdo,$case)) {
            if ($saved['actorId']!==(int)$scope['actor']['id']) throw new TamiranApiException('دستگاه را بازرس دیگری دریافت کرده است.',409);
            $pdo->commit();
            return ['receipt'=>$saved];
        }
        $pdo->prepare('SELECT id FROM repair_shops WHERE id=:shop FOR UPDATE')->execute(['shop'=>$scope['shop_id']]);
        $template=quality_template($pdo,$scope,$case['workflow_code']);
        if (!in_array('repair_issue',array_column($template['items'],'code'),true)) {
            $template=quality_replace_template($pdo,$scope,$template,[
                ['code'=>'repair_issue','title'=>'آیا ایراد اصلی دستگاه برطرف شده است؟','is_required'=>true],...$template['items'],
            ]);
        }
        $stageQuery=$pdo->prepare("SELECT id FROM repair_case_stage_events WHERE workflow_id=:workflow AND to_status='qc_pending' ORDER BY id DESC LIMIT 1");
        $stageQuery->execute(['workflow'=>$case['id']]);
        $stage=(int)$stageQuery->fetchColumn();
        if (!$stage) throw new TamiranApiException('مرحله کنترل کیفیت قابل بازیابی نیست.',409);
        $receipt=['publicId'=>tamiran_id(),'stageId'=>$stage,'actorId'=>(int)$scope['actor']['id'],'template'=>$template];
        $pdo->prepare("INSERT INTO repair_case_events(case_id,actor_user_id,event_type,description,metadata_json)
            VALUES(:case,:actor,'quality_received','بازرس دستگاه را برای کنترل کیفیت دریافت کرد',:metadata)")
            ->execute(['case'=>$case['case_id'],'actor'=>$scope['actor']['id'],'metadata'=>v2_json($receipt)]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'qc.receive','repair_case',$case['case_public_id'],null,['receipt'=>$receipt['publicId'],'templateId'=>$template['id']]);
        $pdo->commit();
        return ['receipt'=>$receipt];
    } catch(Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function quality_run(PDO $pdo,array $scope,array $input):array
{
    $caseId=(int)($input['caseId']??0);
    $key=v2_text($input['idempotencyKey']??'','شناسه یکتای QC',160);
    $selected=(string)($input['result']??'passed');
    if (!in_array($selected,['passed','failed','conditional'],true)) throw new TamiranApiException('نتیجه QC معتبر نیست.');
    if ($selected==='conditional'&&!v2_has_permission($scope,'qc.conditional',['repair_manager'])) {
        throw new TamiranApiException('ثبت قبول مشروط فقط با مجوز مدیر ممکن است.',403);
    }
    $destination=(string)($input['reworkDestination']??'repairing');
    if (!in_array($destination,['diagnosing','repairing'],true)) throw new TamiranApiException('مسیر بازکاری معتبر نیست.');
    $failure=v2_text($input['failureReason']??'','علت مردودی',1000,false);
    $limitations=v2_text($input['conditionalLimitations']??'','محدودیت نتیجه مشروط',1000,false);
    $answers=$input['items']??[];
    $custom=$input['customItems']??[];
    if (!is_array($answers)||!is_array($custom)||count($answers)>101||count($custom)>30) throw new TamiranApiException('ردیف‌های آزمایش معتبر نیستند.');
    $pdo->beginTransaction();
    try {
        $case=v2_case($pdo,$scope,$caseId,true);
        quality_authorize_case($pdo,$scope,$case);
        $replay=$pdo->prepare('SELECT public_id,result,performed_by_user_id FROM repair_qc_runs WHERE case_id=:case AND idempotency_key=:key');
        $replay->execute(['case'=>$caseId,'key'=>$key]);
        if ($old=$replay->fetch()) {
            if ((int)$old['performed_by_user_id']!==(int)$scope['actor']['id']) throw new TamiranApiException('این ثبت متعلق به بازرس دیگری است.',403);
            $pdo->commit();
            return ['completed'=>true,'replayed'=>true,'publicId'=>$old['public_id'],'result'=>$old['result'],'case'=>$case];
        }
        if ($case['process_status']!=='qc_pending') throw new TamiranApiException('پرونده در مرحله QC نیست.',409);
        $receipt=quality_receipt($pdo,$case);
        if (!$receipt||$receipt['actorId']!==(int)$scope['actor']['id']||$receipt['publicId']!==($input['receiptId']??null)) {
            throw new TamiranApiException('ابتدا دریافت فیزیکی دستگاه را برای کنترل کیفیت ثبت کنید.',409);
        }
        $template=$receipt['template'];
        $expected=array_column($template['items'],null,'id');
        $byId=[];
        foreach ($answers as $answer) {
            $id=(int)($answer['templateItemId']??0);
            if (!is_array($answer)||!isset($expected[$id])||isset($byId[$id])) throw new TamiranApiException('آزمایش در چک‌لیست دریافت‌شده نیست یا تکراری است.');
            $byId[$id]=$answer;
        }
        $records=[];
        foreach ($expected as $id=>$item) {
            $answer=$byId[$id]??[];
            $value=(string)($answer['result']??'not_tested');
            if (!in_array($value,['passed','failed','not_applicable','prior','not_tested'],true)
                || (!empty($item['is_required'])&&$value==='not_tested')
                || ($item['code']==='repair_issue'&&!in_array($value,['passed','failed'],true))) {
                throw new TamiranApiException('آزمایش‌های اجباری و نتیجه ایراد اصلی را کامل کنید.');
            }
            $records[]=quality_result_row($pdo,$scope,$caseId,(int)$id,null,$value,$answer);
        }
        foreach ($custom as $answer) {
            if (!is_array($answer)) throw new TamiranApiException('ردیف سفارشی معتبر نیست.');
            $value=(string)($answer['result']??'not_tested');
            if (!in_array($value,['passed','failed','not_applicable','prior','not_tested'],true)) throw new TamiranApiException('نتیجه تست سفارشی معتبر نیست.');
            $records[]=quality_result_row($pdo,$scope,$caseId,null,v2_text($answer['title']??'','عنوان تست سفارشی',240),$value,$answer);
        }
        $failed=false;
        $prior=[];
        foreach ($records as $record) {
            $failed=$failed||$record['result']==='failed';
            if ($record['value']==='prior') $prior[]=$record['notes'];
        }
        $result=$failed?'failed':($prior!==[]&&$selected!=='failed'?'conditional':$selected);
        if ($result==='failed'&&$failure===null) throw new TamiranApiException('برای QC مردود، علت بازکاری الزامی است.');
        if ($result==='conditional') {
            $limitations??=$prior!==[]?mb_substr(implode('؛ ',$prior),0,1000):null;
            if ($limitations===null) throw new TamiranApiException('محدودیت نتیجه مشروط الزامی است.');
        }
        $rework=$pdo->prepare("SELECT COUNT(*) FROM repair_qc_runs WHERE case_id=:case AND result='failed'");
        $rework->execute(['case'=>$caseId]);
        $reworkNumber=(int)$rework->fetchColumn();
        $public=tamiran_id();
        $pdo->prepare('INSERT INTO repair_qc_runs(public_id,shop_id,case_id,template_id,performed_by_user_id,repaired_by_user_id,result,failure_reason,conditional_limitations,rework_number,idempotency_key)
            VALUES(:public,:shop,:case,:template,:actor,:repairer,:result,:failure,:limit,:rework,:key)')
            ->execute(['public'=>$public,'shop'=>$scope['shop_id'],'case'=>$caseId,'template'=>$template['id'],'actor'=>$scope['actor']['id'],
                'repairer'=>$case['primary_technician_user_id'],'result'=>$result,'failure'=>$failure,'limit'=>$limitations,'rework'=>$reworkNumber,'key'=>$key]);
        $runId=(int)$pdo->lastInsertId();
        $insert=$pdo->prepare('INSERT INTO repair_qc_results(qc_run_id,template_item_id,custom_title,result,value_text,evidence_file_id,notes)
            VALUES(:run,:item,:title,:result,:value,:evidence,:notes)');
        foreach ($records as $record) $insert->execute(['run'=>$runId]+$record);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'qc.complete','repair_qc_run',$public,null,
            ['result'=>$result,'reworkNumber'=>$reworkNumber,'templateId'=>$template['id']]);
        if ($result==='failed') {
            $pdo->prepare("INSERT INTO repair_case_events(case_id,actor_user_id,event_type,description,metadata_json)
                VALUES(:case,:actor,'quality_rework_target',:description,:metadata)")
                ->execute(['case'=>$caseId,'actor'=>$scope['actor']['id'],'description'=>$destination==='diagnosing'?'بازکاری از عیب‌یابی مجدد':'بازکاری از عملیات تعمیر',
                    'metadata'=>v2_json(['destination'=>$destination,'qcRun'=>$public])]);
        }
        if ($result==='failed'&&(int)$case['primary_technician_user_id']>0) {
            v2_notify($pdo,$scope,(int)$case['primary_technician_user_id'],'qc_failed','کنترل کیفیت پرونده مردود شد',$failure,'repair_case',$case['case_public_id']);
        }
        $target=match($result){'failed'=>'qc_rework','conditional'=>'qc_conditional',default=>'finance_pending'};
        $fresh=v2_transition($pdo,$scope,$caseId,$target,$failure??$limitations??'تکمیل کنترل کیفیت',(int)$case['lock_version'],hash('sha256','qc:'.$key),true,true);
        $pdo->commit();
        return ['completed'=>true,'replayed'=>false,'publicId'=>$public,'result'=>$result,'case'=>$fresh];
    } catch(Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function quality_result_row(PDO $pdo,array $scope,int $caseId,?int $id,?string $title,string $value,array $answer):array
{
    $notes=v2_text($answer['notes']??'','توضیحات آزمایش',2000,false);
    $evidence=(int)($answer['evidenceFileId']??0)?:null;
    if ($evidence!==null) {
        $file=$pdo->prepare('SELECT id FROM tamiran_private_files WHERE id=:id AND shop_id=:shop AND branch_id=:branch AND case_id=:case');
        $file->execute(['id'=>$evidence,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId]);
        if (!$file->fetchColumn()) throw new TamiranApiException('مستند آزمایش به این پرونده تعلق ندارد.',403);
    }
    if (in_array($value,['failed','not_applicable','prior'],true)&&$notes===null) throw new TamiranApiException('برای مورد مردود، غیرقابل اعمال یا خرابی قبلی توضیح لازم است.');
    return ['item'=>$id,'title'=>$title,'result'=>$value==='prior'?'not_applicable':$value,'value'=>$value==='prior'?'prior':null,'evidence'=>$evidence,'notes'=>$notes];
}

function quality_ack(PDO $pdo,array $scope,array $input):array
{
    $runPublic=v2_text($input['qcRunPublicId']??'','QC',80);$channel=(string)($input['channel']??'');if(!in_array($channel,['sms_otp','in_person_signature','secure_portal'],true))throw new TamiranApiException('روش تأیید محدودیت معتبر نیست.');$statement=$pdo->prepare("SELECT q.*,c.public_id AS case_public_id,cu.mobile FROM repair_qc_runs q INNER JOIN repair_cases c ON c.id=q.case_id INNER JOIN repair_customers cu ON cu.id=c.customer_id WHERE q.public_id=:public AND q.shop_id=:shop AND c.branch_id=:branch AND q.result='conditional' LIMIT 1");$statement->execute(['public'=>$runPublic,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$run=$statement->fetch();if(!is_array($run))throw new TamiranApiException('QC مشروط پیدا نشد.',404);if(in_array($channel,['sms_otp','secure_portal'],true)){if(!function_exists('tamiran_sms_verify_otp')||!tamiran_sms_verify_otp($pdo,$scope['shop_id'],'portal_action',$runPublic,tamiran_mobile($run['mobile']),(string)($input['otpRequestId']??''),(string)($input['otpCode']??'')))throw new TamiranApiException('کد یک‌بارمصرف معتبر نیست.',403);}elseif(!v2_has_permission($scope,'qc.record_customer_ack',['reception','quality_control']))throw new TamiranApiException('ثبت تأیید حضوری مجاز نیست.',403);$pdo->prepare('UPDATE repair_qc_runs SET customer_acknowledged_at=NOW(),customer_ack_channel=:channel WHERE id=:id AND customer_acknowledged_at IS NULL')->execute(['channel'=>$channel,'id'=>$run['id']]);tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'qc.conditional_ack','repair_qc_run',$runPublic,null,['channel'=>$channel]);return['acknowledged'=>true];
}

tamiran_api(static function():array{$pdo=tamiran_db();$scope=v2_scope();v2_require_capability(v2_product_policy($pdo,$scope),'qcEnabled','کنترل کیفیت برای محصول یا تنظیمات این تعمیرگاه فعال نیست.');$method=$_SERVER['REQUEST_METHOD']??'GET';if($method==='GET')return quality_payload($pdo,$scope);if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);tamiran_require_csrf();$input=tamiran_json_body();return match((string)($input['action']??'')){'start'=>quality_start($pdo,$scope,$input),'save_template'=>quality_save_template($pdo,$scope,$input),'run'=>quality_run($pdo,$scope,$input),'ack_conditional'=>quality_ack($pdo,$scope,$input),default=>throw new TamiranApiException('عملیات QC معتبر نیست.'),};});
