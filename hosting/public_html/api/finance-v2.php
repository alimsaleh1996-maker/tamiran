<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';
require_once tamiran_private_root().'/v2-core.php';

function finance_invoice_case(PDO $pdo,array $scope,array $invoice,bool $lock=false):array
{
    return v2_case($pdo,$scope,(int)$invoice['case_id'],$lock);
}

function finance_draft_items(PDO $pdo,int $caseId):array
{
    $items=[];
    $estimate=$pdo->prepare("SELECT id,public_id FROM repair_estimates WHERE case_id=:case AND status='approved' ORDER BY revision DESC,id DESC LIMIT 1");
    $estimate->execute(['case'=>$caseId]);$estimateRow=$estimate->fetch();
    if(is_array($estimateRow)){
        $lines=$pdo->prepare("SELECT item_type AS type,reference_id AS referenceId,title,quantity,unit_price AS saleUnitPrice,0 AS purchaseUnitCost,discount_amount AS discountAmount,tax_rate AS taxRate,0 AS warrantyDays FROM repair_estimate_items WHERE estimate_id=:estimate AND item_type<>'part' ORDER BY id");
        $lines->execute(['estimate'=>$estimateRow['id']]);$items=$lines->fetchAll();
    }
    $parts=$pdo->prepare("SELECT i.id AS referenceId,i.title,SUM(x.quantity) AS quantity,i.sale_price AS saleUnitPrice,i.purchase_price AS purchaseUnitCost,0 AS discountAmount,0 AS taxRate,30 AS warrantyDays FROM repair_part_issues x INNER JOIN repair_inventory_items i ON i.id=x.item_id WHERE x.case_id=:case AND x.status='consumed' GROUP BY i.id,i.title,i.sale_price,i.purchase_price ORDER BY i.title");
    $parts->execute(['case'=>$caseId]);
    foreach($parts->fetchAll()as$part)$items[]=array_merge(['type'=>'part'],$part);
    $manual=$pdo->prepare("SELECT id AS referenceId,title,quantity,sale_unit_price AS saleUnitPrice,purchase_unit_cost AS purchaseUnitCost,0 AS discountAmount,0 AS taxRate,30 AS warrantyDays FROM repair_case_manual_parts WHERE case_id=:case ORDER BY id");
    $manual->execute(['case'=>$caseId]);
    foreach($manual->fetchAll()as$part)$items[]=array_merge(['type'=>'part'],$part);
    return['estimatePublicId'=>is_array($estimateRow)?$estimateRow['public_id']:null,'items'=>$items];
}

function finance_advance_readiness(PDO $pdo,array $scope,int $caseId,string $key):bool
{
    try{
        $case=v2_case($pdo,$scope,$caseId);
        if($case['process_status']==='qc_conditional'&&v2_qc_blockers($pdo,$caseId)===[]){
            v2_transition($pdo,$scope,$caseId,'finance_pending','تأیید محدودیت QC و ورود خودکار به مالی',(int)$case['lock_version'],$key.':finance',true);
            $case=v2_case($pdo,$scope,$caseId);
        }
        if($case['process_status']!=='finance_pending')return false;
        $blockers=v2_case_blockers($pdo,$scope,$case);
        if($blockers['parts']!==[]||$blockers['qc']!==[]||$blockers['finance']!==[])return false;
        v2_transition($pdo,$scope,$caseId,'ready_for_delivery','تمام کنترل‌های تحویل به‌صورت خودکار پاس شد',(int)$case['lock_version'],$key.':ready',true);
        return true;
    }catch(Throwable$error){tamiran_log('warning','automatic_delivery_readiness_failed',['case_id'=>$caseId,'message'=>$error->getMessage()]);return false;}
}

function finance_payload(PDO $pdo,array $scope):array
{
    v2_require_permission($scope,'finance.view',['finance_cashier'],'مشاهده مالی پرونده مجاز نیست.');
    $statement=$pdo->prepare(
        'SELECT i.*,c.receipt_number,cu.full_name AS customer_name
         FROM repair_invoices i
         INNER JOIN repair_cases c ON c.id=i.case_id AND c.shop_id=i.shop_id
         INNER JOIN repair_customers cu ON cu.id=c.customer_id AND cu.shop_id=i.shop_id
         WHERE i.shop_id=:shop AND i.branch_id=:branch
         ORDER BY i.updated_at DESC LIMIT 500'
    );
    $statement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $invoices=$statement->fetchAll();
    $items=$pdo->prepare('SELECT * FROM repair_invoice_items WHERE invoice_id=:invoice ORDER BY id');
    $payments=$pdo->prepare('SELECT * FROM repair_payments WHERE invoice_id=:invoice ORDER BY paid_at,id');
    $refunds=$pdo->prepare('SELECT * FROM repair_refunds WHERE invoice_id=:invoice ORDER BY refunded_at,id');
    $receivables=$pdo->prepare('SELECT * FROM repair_receivables WHERE invoice_id=:invoice ORDER BY created_at DESC');
    $ledger=$pdo->prepare('SELECT public_id,event_type,customer_balance_delta,cash_delta,direct_cost_delta,reference_type,reference_public_id,metadata_json,occurred_at FROM repair_financial_ledger WHERE invoice_id=:invoice ORDER BY occurred_at,id');
    foreach($invoices as &$invoice){
        $items->execute(['invoice'=>$invoice['id']]);
        $invoice['items']=$items->fetchAll();
        $payments->execute(['invoice'=>$invoice['id']]);
        $invoice['payments']=$payments->fetchAll();
        $refunds->execute(['invoice'=>$invoice['id']]);
        $invoice['refunds']=$refunds->fetchAll();
        $receivables->execute(['invoice'=>$invoice['id']]);
        $invoice['receivables']=$receivables->fetchAll();
        $ledger->execute(['invoice'=>$invoice['id']]);
        $invoice['ledger']=$ledger->fetchAll();
        $invoice['balance']=(int)$invoice['total_amount']-((int)$invoice['paid_amount']-(int)$invoice['refunded_amount']);
        $directCost=0;
        foreach($invoice['items'] as $item){
            $directCost+=(int)round((float)$item['quantity']*(int)$item['purchase_unit_cost']);
        }
        $invoice['directCost']=$directCost;
        $invoice['grossOperationalProfit']=(int)$invoice['total_amount']-(int)$invoice['tax_amount']-$directCost;
    }
    unset($invoice);
    $draftStatement=$pdo->prepare("SELECT c.id AS caseId,c.receipt_number AS receiptNumber,cu.full_name AS customerName FROM repair_case_workflows w INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN repair_customers cu ON cu.id=c.customer_id LEFT JOIN repair_invoices i ON i.case_id=c.id WHERE w.shop_id=:shop AND w.branch_id=:branch AND w.process_status IN ('finance_pending','qc_conditional') AND i.id IS NULL ORDER BY w.updated_at");
    $draftStatement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$drafts=$draftStatement->fetchAll();
    foreach($drafts as&$draft)$draft=array_merge($draft,finance_draft_items($pdo,(int)$draft['caseId']));unset($draft);
    return['invoices'=>$invoices,'drafts'=>$drafts];
}

function finance_issue(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'finance.issue',['finance_cashier'],'صدور فاکتور مجاز نیست.');
    $caseId=(int)($input['caseId']??0);
    $idempotency=v2_text($input['idempotencyKey']??('repair-invoice-'.$caseId),'شناسه یکتای صدور فاکتور',160);
    $items=is_array($input['items']??null)?$input['items']:[];
    $estimatePublic=trim((string)($input['estimatePublicId']??''));
    if($items===[]&&$estimatePublic!==''){
        $estimate=$pdo->prepare("SELECT id FROM repair_estimates WHERE public_id=:public AND shop_id=:shop AND case_id=:case AND status='approved'");
        $estimate->execute(['public'=>$estimatePublic,'shop'=>$scope['shop_id'],'case'=>$caseId]);
        $estimateId=(int)$estimate->fetchColumn();
        if($estimateId<1)throw new TamiranApiException('برآورد تأییدشده پیدا نشد.',404);
        $estimateItems=$pdo->prepare('SELECT ei.item_type AS type,ei.reference_id AS referenceId,ei.title,ei.quantity,ei.unit_price AS unitPrice,ei.discount_amount AS discountAmount,ei.tax_rate AS taxRate,0 AS warrantyDays FROM repair_estimate_items ei WHERE ei.estimate_id=:estimate');
        $estimateItems->execute(['estimate'=>$estimateId]);
        $items=$estimateItems->fetchAll();
    }
    if($items===[]||count($items)>200)throw new TamiranApiException('حداقل یک ردیف فاکتور الزامی است.');

    $pdo->beginTransaction();
    try{
        $case=v2_case($pdo,$scope,$caseId,true);
        if($case['locked_at']!==null)throw new TamiranApiException('پرونده بسته قابل صدور فاکتور نیست.',409);
        $duplicate=$pdo->prepare('SELECT public_id,invoice_number,total_amount FROM repair_invoices WHERE (case_id=:case OR (shop_id=:shop AND idempotency_key=:idempotency)) LIMIT 1 FOR UPDATE');
        $duplicate->execute(['case'=>$caseId,'shop'=>$scope['shop_id'],'idempotency'=>$idempotency]);
        $existing=$duplicate->fetch();
        if(is_array($existing)){
            $pdo->commit();
            $ready=finance_advance_readiness($pdo,$scope,$caseId,'invoice:'.$existing['public_id']);
            return['issued'=>true,'replayed'=>true,'publicId'=>$existing['public_id'],'invoiceNumber'=>$existing['invoice_number'],'totalAmount'=>(int)$existing['total_amount'],'readyForDelivery'=>$ready];
        }

        $subtotal=0;$discountTotal=0;$taxTotal=0;$laborBasis=0;$partBasis=0;$directCost=0;$normalized=[];
        foreach($items as $item){
            $type=(string)($item['type']??'');
            if(!in_array($type,['part','labor','diagnostic','other'],true))throw new TamiranApiException('نوع ردیف فاکتور معتبر نیست.');
            $title=v2_text($item['title']??'','عنوان ردیف',240);
            $quantity=(float)($item['quantity']??1);
            $purchase=max(0,(int)($item['purchaseUnitCost']??0));
            $sale=max(0,(int)($item['saleUnitPrice']??$item['unitPrice']??0));
            $discount=max(0,(int)($item['discountAmount']??0));
            $taxRate=(float)($item['taxRate']??0);
            if($quantity<=0||$taxRate<0||$taxRate>100)throw new TamiranApiException('مقدار ردیف معتبر نیست.');
            $base=(int)round($quantity*$sale);
            if($discount>$base)throw new TamiranApiException('تخفیف ردیف معتبر نیست.');
            if($discount>0&&$scope['role']!=='repair_manager')throw new TamiranApiException('اعمال تخفیف فقط برای مدیر مجاز است.',403);
            $netBase=$base-$discount;
            if($type==='labor')$laborBasis+=$netBase;
            if($type==='part'){
                $partBasis+=$netBase;
                $directCost+=(int)round($quantity*$purchase);
            }
            $tax=(int)round($netBase*$taxRate/100);
            $subtotal+=$base;$discountTotal+=$discount;$taxTotal+=$tax;
            $normalized[]=[$type,$item['referenceId']??null,$title,$quantity,$purchase,$sale,$discount,$taxRate,$tax,$netBase+$tax,max(0,(int)($item['warrantyDays']??0))];
        }

        $pdo->prepare('SELECT id FROM repair_shops WHERE id=:shop FOR UPDATE')->execute(['shop'=>$scope['shop_id']]);
        $sequence=$pdo->prepare('SELECT COUNT(*)+1 FROM repair_invoices WHERE shop_id=:shop');
        $sequence->execute(['shop'=>$scope['shop_id']]);
        $number='INV-'.$scope['shop_id'].'-'.str_pad((string)$sequence->fetchColumn(),7,'0',STR_PAD_LEFT);
        $invoicePublic=tamiran_id();
        $total=$subtotal-$discountTotal+$taxTotal;
        $pdo->prepare("INSERT INTO repair_invoices(public_id,invoice_number,shop_id,branch_id,case_id,status,subtotal_amount,discount_amount,tax_amount,total_amount,issued_by_user_id,idempotency_key,issued_at) VALUES(:public,:number,:shop,:branch,:case,'issued',:subtotal,:discount,:tax,:total,:actor,:idempotency,NOW())")->execute([
            'public'=>$invoicePublic,'number'=>$number,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId,
            'subtotal'=>$subtotal,'discount'=>$discountTotal,'tax'=>$taxTotal,'total'=>$total,'actor'=>$scope['actor']['id'],'idempotency'=>$idempotency,
        ]);
        $invoiceId=(int)$pdo->lastInsertId();
        $insert=$pdo->prepare('INSERT INTO repair_invoice_items(public_id,invoice_id,item_type,reference_id,title,quantity,purchase_unit_cost,sale_unit_price,discount_amount,tax_rate,tax_amount,line_total,warranty_days) VALUES(:public,:invoice,:type,:reference,:title,:quantity,:purchase,:sale,:discount,:tax_rate,:tax,:total,:warranty)');
        foreach($normalized as $line)$insert->execute(['public'=>tamiran_id(),'invoice'=>$invoiceId,'type'=>$line[0],'reference'=>$line[1],'title'=>$line[2],'quantity'=>$line[3],'purchase'=>$line[4],'sale'=>$line[5],'discount'=>$line[6],'tax_rate'=>$line[7],'tax'=>$line[8],'total'=>$line[9],'warranty'=>$line[10]]);

        v2_financial_event($pdo,$scope,$case,$invoiceId,'invoice_issued',$subtotal+$taxTotal,0,0,'repair_invoice',$invoicePublic,'invoice:'.$invoicePublic,['invoiceNumber'=>$number,'subtotal'=>$subtotal,'tax'=>$taxTotal]);
        if($discountTotal>0)v2_financial_event($pdo,$scope,$case,$invoiceId,'discount_applied',-$discountTotal,0,0,'repair_invoice',$invoicePublic,'discount:'.$invoicePublic,['amount'=>$discountTotal]);
        if($directCost>0)v2_financial_event($pdo,$scope,$case,$invoiceId,'part_cost_posted',0,0,$directCost,'repair_invoice',$invoicePublic,'part-cost:'.$invoicePublic,['amount'=>$directCost]);

        $assignments=$pdo->prepare('SELECT * FROM repair_case_assignments WHERE workflow_id=:workflow');
        $assignments->execute(['workflow'=>$case['id']]);
        $compensation=$pdo->prepare('INSERT INTO repair_technician_compensations(public_id,case_id,technician_user_id,source_type,basis_amount,rate_percent,fixed_amount,calculated_amount,policy_snapshot_json,approved_by_user_id) VALUES(:public,:case,:technician,:source,:basis,:rate,:fixed,:calculated,:policy,:approver)');
        foreach($assignments->fetchAll()as $assignment){
            $fixed=(int)$assignment['fixed_fee'];$laborRate=(float)$assignment['labor_percent'];
            $laborCalculated=$fixed+(int)round($laborBasis*$laborRate/100);
            if($laborCalculated>0){
                $compensationPublic=tamiran_id();
                $compensation->execute(['public'=>$compensationPublic,'case'=>$caseId,'technician'=>$assignment['technician_user_id'],'source'=>'labor','basis'=>$laborBasis,'rate'=>$laborRate,'fixed'=>$fixed,'calculated'=>$laborCalculated,'policy'=>v2_json(['assignmentPublicId'=>$assignment['public_id'],'model'=>$assignment['compensation_model']]),'approver'=>$scope['role']==='repair_manager'?$scope['actor']['id']:null]);
                v2_financial_event($pdo,$scope,$case,$invoiceId,'technician_commission_accrued',0,0,$laborCalculated,'repair_technician_compensation',$compensationPublic,'commission:'.$compensationPublic,['source'=>'labor','technicianUserId'=>$assignment['technician_user_id']]);
            }
            $partRate=(float)$assignment['part_sale_percent'];
            if($partRate>0&&$assignment['part_percent_approved_by_user_id']!==null){
                $partCalculated=(int)round($partBasis*$partRate/100);
                if($partCalculated>0){
                    $compensationPublic=tamiran_id();
                    $compensation->execute(['public'=>$compensationPublic,'case'=>$caseId,'technician'=>$assignment['technician_user_id'],'source'=>'part_sale','basis'=>$partBasis,'rate'=>$partRate,'fixed'=>0,'calculated'=>$partCalculated,'policy'=>v2_json(['assignmentPublicId'=>$assignment['public_id'],'approvedBy'=>$assignment['part_percent_approved_by_user_id']]),'approver'=>$assignment['part_percent_approved_by_user_id']]);
                    v2_financial_event($pdo,$scope,$case,$invoiceId,'technician_commission_accrued',0,0,$partCalculated,'repair_technician_compensation',$compensationPublic,'commission:'.$compensationPublic,['source'=>'part_sale','technicianUserId'=>$assignment['technician_user_id']]);
                }
            }
        }
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'invoice.issue','repair_invoice',$invoicePublic,null,['number'=>$number,'total'=>$total,'directCost'=>$directCost]);
        $pdo->commit();
        $ready=finance_advance_readiness($pdo,$scope,$caseId,'invoice:'.$invoicePublic);
        return['issued'=>true,'publicId'=>$invoicePublic,'invoiceNumber'=>$number,'totalAmount'=>$total,'readyForDelivery'=>$ready];
    }catch(Throwable $error){
        if($pdo->inTransaction())$pdo->rollBack();
        throw$error;
    }
}

function finance_payment(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'finance.payment',['finance_cashier'],'ثبت پرداخت مجاز نیست.');
    $invoicePublic=v2_text($input['invoicePublicId']??'','فاکتور',80);
    $amount=(int)($input['amount']??0);$method=(string)($input['method']??'');
    $idempotency=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه یکتای پرداخت',100);
    if($amount<1||!in_array($method,['cash','card','bank_transfer','online','credit'],true))throw new TamiranApiException('مبلغ یا روش پرداخت معتبر نیست.');
    $pdo->beginTransaction();
    try{
        $statement=$pdo->prepare("SELECT * FROM repair_invoices WHERE public_id=:public AND shop_id=:shop AND branch_id=:branch AND status NOT IN ('corrected','voided') FOR UPDATE");
        $statement->execute(['public'=>$invoicePublic,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
        $invoice=$statement->fetch();if(!is_array($invoice))throw new TamiranApiException('فاکتور پیدا نشد.',404);
        $existing=$pdo->prepare('SELECT public_id,amount FROM repair_payments WHERE invoice_id=:invoice AND idempotency_key=:idempotency LIMIT 1');
        $existing->execute(['invoice'=>$invoice['id'],'idempotency'=>$idempotency]);$replayed=$existing->fetch();
        if(is_array($replayed)){
            $remaining=(int)$invoice['total_amount']-((int)$invoice['paid_amount']-(int)$invoice['refunded_amount']);
            $pdo->commit();$ready=finance_advance_readiness($pdo,$scope,(int)$invoice['case_id'],'payment:'.$idempotency);return['paid'=>true,'replayed'=>true,'publicId'=>$replayed['public_id'],'remaining'=>$remaining,'readyForDelivery'=>$ready];
        }
        $balance=(int)$invoice['total_amount']-((int)$invoice['paid_amount']-(int)$invoice['refunded_amount']);
        if($amount>$balance)throw new TamiranApiException('مبلغ پرداخت از مانده فاکتور بیشتر است.',409);
        $case=finance_invoice_case($pdo,$scope,$invoice);
        $paymentPublic=tamiran_id();
        $pdo->prepare('INSERT INTO repair_payments(public_id,invoice_id,amount,method,tracking_number,paid_by_name,received_by_user_id,idempotency_key,notes) VALUES(:public,:invoice,:amount,:method,:tracking,:payer,:actor,:idempotency,:notes)')->execute(['public'=>$paymentPublic,'invoice'=>$invoice['id'],'amount'=>$amount,'method'=>$method,'tracking'=>v2_text($input['trackingNumber']??'','شماره پیگیری',160,false),'payer'=>v2_text($input['paidByName']??'','پرداخت‌کننده',180,false),'actor'=>$scope['actor']['id'],'idempotency'=>$idempotency,'notes'=>v2_text($input['notes']??'','توضیحات',2000,false)]);
        $paid=(int)$invoice['paid_amount']+$amount;$status=$paid-(int)$invoice['refunded_amount']>=(int)$invoice['total_amount']?'paid':'partially_paid';
        $pdo->prepare('UPDATE repair_invoices SET paid_amount=:paid,status=:status WHERE id=:id')->execute(['paid'=>$paid,'status'=>$status,'id'=>$invoice['id']]);
        $pdo->prepare("UPDATE repair_receivables SET outstanding_amount=GREATEST(0,outstanding_amount-:amount),status=CASE WHEN outstanding_amount<=:amount2 THEN 'settled' ELSE 'partially_paid' END,settled_at=CASE WHEN outstanding_amount<=:amount3 THEN NOW() ELSE NULL END WHERE invoice_id=:invoice AND status IN ('open','partially_paid','overdue')")->execute(['amount'=>$amount,'amount2'=>$amount,'amount3'=>$amount,'invoice'=>$invoice['id']]);
        v2_financial_event($pdo,$scope,$case,(int)$invoice['id'],'payment_received',-$amount,$amount,0,'repair_payment',$paymentPublic,'payment:'.$idempotency,['method'=>$method]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'payment.create','repair_payment',$paymentPublic,null,['invoice'=>$invoicePublic,'amount'=>$amount,'method'=>$method]);
        $pdo->commit();$ready=finance_advance_readiness($pdo,$scope,(int)$invoice['case_id'],'payment:'.$idempotency);return['paid'=>true,'publicId'=>$paymentPublic,'remaining'=>$balance-$amount,'readyForDelivery'=>$ready];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
}

function finance_refund(PDO $pdo,array $scope,array $input):array
{
    if($scope['role']!=='repair_manager')throw new TamiranApiException('استرداد وجه فقط برای مدیر مجاز است.',403);
    $invoicePublic=v2_text($input['invoicePublicId']??'','فاکتور',80);$amount=(int)($input['amount']??0);
    $reason=v2_text($input['reason']??'','علت استرداد',1000);$method=(string)($input['method']??'');
    $idempotency=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه یکتا',100);
    if($amount<1||!in_array($method,['cash','card','bank_transfer','online','credit'],true))throw new TamiranApiException('استرداد معتبر نیست.');
    $pdo->beginTransaction();
    try{
        $statement=$pdo->prepare('SELECT * FROM repair_invoices WHERE public_id=:public AND shop_id=:shop AND branch_id=:branch FOR UPDATE');
        $statement->execute(['public'=>$invoicePublic,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$invoice=$statement->fetch();
        if(!is_array($invoice))throw new TamiranApiException('فاکتور پیدا نشد.',404);
        $existing=$pdo->prepare('SELECT public_id FROM repair_refunds WHERE invoice_id=:invoice AND idempotency_key=:idempotency LIMIT 1');
        $existing->execute(['invoice'=>$invoice['id'],'idempotency'=>$idempotency]);$replayed=$existing->fetchColumn();
        if(is_string($replayed)){$pdo->commit();return['refunded'=>true,'replayed'=>true,'publicId'=>$replayed];}
        if($amount>((int)$invoice['paid_amount']-(int)$invoice['refunded_amount']))throw new TamiranApiException('مبلغ استرداد بیش از وجه دریافتی است.',409);
        $case=finance_invoice_case($pdo,$scope,$invoice);$refundPublic=tamiran_id();
        $pdo->prepare('INSERT INTO repair_refunds(public_id,invoice_id,amount,method,tracking_number,reason,processed_by_user_id,idempotency_key) VALUES(:public,:invoice,:amount,:method,:tracking,:reason,:actor,:idempotency)')->execute(['public'=>$refundPublic,'invoice'=>$invoice['id'],'amount'=>$amount,'method'=>$method,'tracking'=>v2_text($input['trackingNumber']??'','شماره پیگیری',160,false),'reason'=>$reason,'actor'=>$scope['actor']['id'],'idempotency'=>$idempotency]);
        $refunded=(int)$invoice['refunded_amount']+$amount;
        $pdo->prepare("UPDATE repair_invoices SET refunded_amount=:refunded,status='partially_paid' WHERE id=:id")->execute(['refunded'=>$refunded,'id'=>$invoice['id']]);
        v2_financial_event($pdo,$scope,$case,(int)$invoice['id'],'refund_issued',$amount,-$amount,0,'repair_refund',$refundPublic,'refund:'.$idempotency,['method'=>$method,'reason'=>$reason]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'refund.create','repair_refund',$refundPublic,null,['invoice'=>$invoicePublic,'amount'=>$amount],$reason);
        $pdo->commit();return['refunded'=>true,'publicId'=>$refundPublic];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
}

function finance_receivable(PDO $pdo,array $scope,array $input):array
{
    if($scope['role']!=='repair_manager')throw new TamiranApiException('مجوز تحویل با مانده فقط برای مدیر همان پرونده است.',403);
    $invoicePublic=v2_text($input['invoicePublicId']??'','فاکتور',80);$due=v2_text($input['dueAt']??'','سررسید',40);
    $commitment=v2_text($input['customerCommitmentText']??'','تعهد مشتری',4000);
    $pdo->beginTransaction();
    try{
        $statement=$pdo->prepare('SELECT i.*,s.allow_delivery_with_balance FROM repair_invoices i INNER JOIN repair_shops s ON s.id=i.shop_id WHERE i.public_id=:public AND i.shop_id=:shop AND i.branch_id=:branch FOR UPDATE');
        $statement->execute(['public'=>$invoicePublic,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$invoice=$statement->fetch();
        if(!is_array($invoice))throw new TamiranApiException('فاکتور پیدا نشد.',404);
        if(!(bool)$invoice['allow_delivery_with_balance'])throw new TamiranApiException('تحویل با مانده در تنظیمات تعمیرگاه فعال نیست.',409);
        $open=$pdo->prepare("SELECT public_id,original_amount FROM repair_receivables WHERE invoice_id=:invoice AND status IN ('open','partially_paid','overdue') LIMIT 1 FOR UPDATE");
        $open->execute(['invoice'=>$invoice['id']]);$existing=$open->fetch();
        if(is_array($existing)){$pdo->commit();$ready=finance_advance_readiness($pdo,$scope,(int)$invoice['case_id'],'receivable:'.$existing['public_id']);return['created'=>true,'replayed'=>true,'publicId'=>$existing['public_id'],'amount'=>(int)$existing['original_amount'],'readyForDelivery'=>$ready];}
        $balance=(int)$invoice['total_amount']-((int)$invoice['paid_amount']-(int)$invoice['refunded_amount']);
        if($balance<1)throw new TamiranApiException('فاکتور مانده‌ای ندارد.',409);
        $case=finance_invoice_case($pdo,$scope,$invoice);$receivablePublic=tamiran_id();
        $pdo->prepare('INSERT INTO repair_receivables(public_id,invoice_id,case_id,original_amount,outstanding_amount,due_at,customer_commitment_text,customer_evidence_json,approved_by_manager_user_id) VALUES(:public,:invoice,:case,:amount,:outstanding,:due,:commitment,:evidence,:actor)')->execute(['public'=>$receivablePublic,'invoice'=>$invoice['id'],'case'=>$invoice['case_id'],'amount'=>$balance,'outstanding'=>$balance,'due'=>$due,'commitment'=>$commitment,'evidence'=>v2_json($input['evidence']??[]),'actor'=>$scope['actor']['id']]);
        v2_financial_event($pdo,$scope,$case,(int)$invoice['id'],'receivable_opened',0,0,0,'repair_receivable',$receivablePublic,'receivable:'.$receivablePublic,['amount'=>$balance,'dueAt'=>$due]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'receivable.create','repair_receivable',$receivablePublic,null,['invoice'=>$invoicePublic,'amount'=>$balance,'dueAt'=>$due],'مجوز موردی مدیر برای تحویل با مانده');
        $pdo->commit();$ready=finance_advance_readiness($pdo,$scope,(int)$invoice['case_id'],'receivable:'.$receivablePublic);return['created'=>true,'publicId'=>$receivablePublic,'amount'=>$balance,'readyForDelivery'=>$ready];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
}

tamiran_api(static function():array{
    $pdo=tamiran_db();$scope=v2_scope();$method=$_SERVER['REQUEST_METHOD']??'GET';
    v2_require_capability(v2_product_policy($pdo,$scope),'financeEnabled','ماژول مالی برای این تعمیرگاه فعال نیست.');
    if($method==='GET')return finance_payload($pdo,$scope);
    if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);
    tamiran_require_csrf();$input=tamiran_json_body();
    return match((string)($input['action']??'')){
        'issue'=>finance_issue($pdo,$scope,$input),'payment'=>finance_payment($pdo,$scope,$input),
        'refund'=>finance_refund($pdo,$scope,$input),'receivable'=>finance_receivable($pdo,$scope,$input),
        default=>throw new TamiranApiException('عملیات مالی معتبر نیست.'),
    };
});
