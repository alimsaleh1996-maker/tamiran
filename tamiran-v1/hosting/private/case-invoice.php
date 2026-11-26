<?php
declare(strict_types=1);

function case_invoice_default(PDO $pdo,int $caseId):array
{
    $items=[];
    $state=$pdo->prepare('SELECT result FROM repair_cases WHERE id=:case');$state->execute(['case'=>$caseId]);$unrepaired=$state->fetchColumn()==='not_repaired';
    $estimate=$pdo->prepare('SELECT id,public_id,status,diagnostic_fee FROM repair_estimates WHERE case_id=:case ORDER BY revision DESC,id DESC LIMIT 1');$estimate->execute(['case'=>$caseId]);$e=$estimate->fetch();
    if(is_array($e)&&($e['status']==='approved'||$unrepaired)){
        $lines=$pdo->prepare("SELECT item_type AS type,reference_id AS referenceId,title,quantity,unit_price AS saleUnitPrice,0 AS purchaseUnitCost,discount_amount AS discountAmount,tax_rate AS taxRate,0 AS warrantyDays FROM repair_estimate_items WHERE estimate_id=:estimate AND ".($unrepaired?"item_type='diagnostic'":"item_type<>'part'").' ORDER BY id');$lines->execute(['estimate'=>$e['id']]);$items=$lines->fetchAll();
        if((int)$e['diagnostic_fee']>0)$items[]=['type'=>'diagnostic','referenceId'=>null,'title'=>'هزینه عیب‌یابی','quantity'=>1,'saleUnitPrice'=>(int)$e['diagnostic_fee'],'purchaseUnitCost'=>0,'discountAmount'=>0,'taxRate'=>0,'warrantyDays'=>0];
    }
    foreach(technician_billable_parts($pdo,$caseId) as $part){if($unrepaired)$part['warrantyDays']=0;$items[]=$part;}
    return ['estimatePublicId'=>is_array($e)&&$e['status']==='approved'?$e['public_id']:null,'items'=>$items,'unrepaired'=>$unrepaired];
}

function case_invoice_saved(PDO $pdo,int $caseId):?array
{
    $query=$pdo->prepare("SELECT metadata_json FROM repair_case_events WHERE case_id=:case
        AND event_type='pre_qc_invoice' ORDER BY id DESC LIMIT 1");
    $query->execute(['case'=>$caseId]);
    $result=json_decode((string)$query->fetchColumn(),true);
    return is_array($result)?$result:null;
}

function case_invoice_authorized_amount(PDO $pdo,array $case):int
{
    $estimate=$pdo->prepare('SELECT status,total_amount,valid_until FROM repair_estimates WHERE case_id=:case ORDER BY revision DESC,id DESC LIMIT 1');
    $estimate->execute(['case'=>(int)$case['case_id']]);
    $approval=$estimate->fetch();
    $authorized=(int)$case['preapproved_amount'];
    if (is_array($approval)&&$approval['status']==='approved'&&(empty($approval['valid_until'])||strtotime($approval['valid_until'])>=time())) {
        $authorized=max($authorized,(int)$approval['total_amount']);
    }
    return $authorized;
}

function case_invoice_preview(PDO $pdo,array $scope,array $case,mixed $adjustments=null,?array $initial=null):array
{
    $caseId=(int)$case['case_id'];
    $draft=$initial??case_invoice_default($pdo,$caseId);
    $authorized=case_invoice_authorized_amount($pdo,$case);
    $mayEditPrice=$scope['role']==='repair_manager'||in_array('finance.issue',$scope['permissions'],true);
    if ($adjustments!==null&&!is_array($adjustments)) throw new TamiranApiException('پیش‌نویس فاکتور معتبر نیست.');
    if (isset($adjustments['laborAmount'])) {
        $labor=technician_money($adjustments['laborAmount']);
        $draft['items']=array_values(array_filter($draft['items'],static fn(array $row):bool=>$row['type']!=='labor'));
        if ($labor>0) $draft['items'][]=case_invoice_service_line('labor','اجرت تعمیر',$labor);
    }
    $additional=$adjustments['extra']??[];
    $prices=$adjustments['partPrices']??[];
    if (!is_array($additional)||count($additional)>30||!is_array($prices)||count($prices)>500) {
        throw new TamiranApiException('ردیف‌های اضافه یا قیمت قطعات معتبر نیستند.');
    }
    if ($prices!==[]&&!$mayEditPrice) throw new TamiranApiException('تغییر قیمت قطعه در دسترسی شما نیست.',403);
    foreach ($additional as $line) {
        if (!is_array($line)) throw new TamiranApiException('ردیف هزینه معتبر نیست.');
        $draft['items'][]=case_invoice_service_line('other',v2_text($line['title']??'','عنوان هزینه',240),technician_money($line['amount']??null));
    }
    $total=0;
    foreach ($draft['items'] as &$line) {
        $source=$line['sourceKey']??null;
        if ($source!==null&&array_key_exists($source,$prices)) {
            $line['saleUnitPrice']=technician_money($prices[$source]);
            unset($prices[$source]);
        }
        $base=(int)round((float)$line['quantity']*(int)$line['saleUnitPrice'])-(int)$line['discountAmount'];
        if ($base<0) throw new TamiranApiException('مبلغ ردیف فاکتور معتبر نیست.');
        $line['lineTotal']=$base+(int)round($base*(float)$line['taxRate']/100);
        $total+=$line['lineTotal'];
    }
    unset($line);
    if ($prices!==[]) throw new TamiranApiException('قطعهٔ پیش‌نویس تغییر کرده است؛ دوباره بررسی کنید.',409);
    if ($total>1000000000000) throw new TamiranApiException('جمع فاکتور خارج از محدوده است.');
    return array_replace($draft,['totalAmount'=>$total,'authorizedAmount'=>$authorized,'mayEditPartPrices'=>$mayEditPrice]);
}

function case_invoice_service_line(string $type,string $title,int $amount):array
{
    return ['type'=>$type,'referenceId'=>null,'title'=>$title,'quantity'=>1,'saleUnitPrice'=>$amount,'purchaseUnitCost'=>0,
        'discountAmount'=>0,'taxRate'=>0,'warrantyDays'=>0];
}

function case_invoice_public(array $draft):array
{
    foreach ($draft['items'] as &$line) unset($line['purchaseUnitCost']);
    return $draft;
}

function case_invoice_record(PDO $pdo,array $scope,array $case,mixed $adjustments=null,?array $initial=null,?string $reason=null):array
{
    $invoice=case_invoice_preview($pdo,$scope,$case,$adjustments,$initial);
    if (isset($adjustments['expectedTotal']) && technician_money($adjustments['expectedTotal'])!==$invoice['totalAmount']) {
        throw new TamiranApiException('مبلغ پیش‌نویس تغییر کرده است؛ جمع فاکتور را دوباره بررسی کنید.',409);
    }
    if ($invoice['totalAmount']>$invoice['authorizedAmount']) {
        throw new TamiranApiException('جمع پیش‌نویس از مبلغ مورد تأیید مشتری بیشتر است؛ تأیید مجدد بگیرید.',409);
    }
    $pdo->prepare("INSERT INTO repair_case_events(case_id,actor_user_id,event_type,description,metadata_json)
        VALUES(:case,:actor,'pre_qc_invoice',:description,:draft)")
        ->execute(['case'=>$case['case_id'],'actor'=>$scope['actor']['id'],'description'=>$reason===null?'ثبت پیش‌نویس فاکتور پیش از ارجاع':'اصلاح پیش‌نویس فاکتور','draft'=>v2_json($invoice)]);
    tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.invoice.draft','repair_case',
        $case['case_public_id'],$initial===null?null:['total'=>$initial['totalAmount']],['total'=>$invoice['totalAmount'],'authorized'=>$invoice['authorizedAmount']],$reason);
    return $invoice;
}

function case_invoice_correct(PDO $pdo,array $scope,array $input):array
{
    $caseId=(int)($input['caseId']??0);
    $key=v2_text($input['idempotencyKey']??'','شناسه اصلاح پیش‌نویس',160);
    $reason=v2_text($input['reason']??'','علت اصلاح فاکتور',1000);
    $adjustments=$input['invoice']??null;
    if (!is_array($adjustments)||$adjustments===[]) throw new TamiranApiException('تغییری برای اصلاح ارسال نشده است.');
    $manager=$scope['role']==='repair_manager';
    $finance=$scope['role']==='finance_cashier'&&v2_has_permission($scope,'finance.issue',['finance_cashier']);
    if (!$manager&&!$finance&&$scope['role']!=='technician') throw new TamiranApiException('اصلاح پیش‌نویس مجاز نیست.',403);
    $pdo->beginTransaction();
    try {
        $case=v2_case($pdo,$scope,$caseId,true);
        if ($scope['role']==='technician') technician_access($pdo,$scope,$case,true);
        $payload=['description'=>$reason,'invoice'=>$adjustments];
        if ($old=technician_replay($pdo,$case,$scope,'case_invoice_correct',$key,$payload)) {
            $pdo->commit();
            return $old;
        }
        if ($case['locked_at']!==null||(int)$case['lock_version']!==(int)($input['lockVersion']??-1)) {
            throw new TamiranApiException('پرونده قفل شده یا نسخه آن تغییر کرده است.',409);
        }
        if (!in_array($case['process_status'],['qc_pending','qc_conditional','finance_pending'],true)
            || ($finance&&$case['process_status']!=='finance_pending')) {
            throw new TamiranApiException('اصلاح در این مرحله برای نقش فعلی مجاز نیست.',409);
        }
        if (!$manager&&!$finance) {
            $qc=$pdo->prepare("SELECT 1 FROM repair_case_events e
                WHERE e.case_id=:case AND e.event_type='quality_received'
                AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.stageId'))=(
                    SELECT MAX(id) FROM repair_case_stage_events WHERE workflow_id=:workflow AND to_status='qc_pending'
                ) LIMIT 1");
            $qc->execute(['case'=>$caseId,'workflow'=>$case['id']]);
            if ($case['process_status']!=='qc_pending'||$qc->fetchColumn()) {
                throw new TamiranApiException('پس از دریافت دستگاه در QC، اصلاح فقط با مدیر یا واحد مالی مجاز است.',403);
            }
        }
        $issued=$pdo->prepare('SELECT id FROM repair_invoices WHERE case_id=:case FOR UPDATE');
        $issued->execute(['case'=>$caseId]);
        if ($issued->fetchColumn()!==false) throw new TamiranApiException('پس از صدور، فقط سند اصلاح مالی قابل ثبت است.',409);
        $previous=case_invoice_saved($pdo,$caseId);
        if (!$previous||$previous['unrepaired']) throw new TamiranApiException('پیش‌نویس قابل اصلاح در پرونده پیدا نشد.',409);
        $invoice=case_invoice_record($pdo,$scope,$case,$adjustments,$previous,$reason);
        $pdo->prepare('UPDATE repair_case_workflows SET lock_version=lock_version+1 WHERE id=:id')->execute(['id'=>$case['id']]);
        $event=technician_event($pdo,$scope,$case,'case_invoice_correct',$key,$payload,['totalAmount'=>$invoice['totalAmount']]);
        $pdo->commit();
        return $event;
    } catch(Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
