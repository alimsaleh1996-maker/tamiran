<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';

/** حذف زمان‌بندی‌شده فقط برای داده‌های موقت؛ Audit و دفتر مالی هرگز پاک نمی‌شوند. */
tamiran_api(static function():array{
    $config=tamiran_config();
    $isCli=PHP_SAPI==='cli';
    if(!$isCli&&($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);
    $expected=(string)($config['retention']['cron_token']??'');
    $provided=(string)($_SERVER['HTTP_X_TAMIRAN_RETENTION_TOKEN']??'');
    if(!$isCli&&(!tamiran_secret_is_configured($expected)||!hash_equals($expected,$provided))){
        throw new TamiranApiException('دسترسی worker نگهداری داده مجاز نیست.',403);
    }

    $pdo=tamiran_db();
    $policies=$pdo->query(
        'SELECT p.* FROM tamiran_data_retention_policies p
         INNER JOIN repair_shops s ON s.id=p.shop_id ORDER BY p.shop_id'
    )->fetchAll();
    $results=[];
    foreach($policies as $policy){
        $shopId=(int)$policy['shop_id'];$runPublic=tamiran_id();
        $pdo->prepare("INSERT INTO tamiran_retention_runs(public_id,shop_id,status,result_json) VALUES(:public,:shop,'running','{}')")
            ->execute(['public'=>$runPublic,'shop'=>$shopId]);
        try{
            $pdo->beginTransaction();
            $otpDays=max(1,(int)$policy['otp_days']);$draftDays=max(1,(int)$policy['reception_draft_days']);$smsDays=max(1,(int)$policy['sms_log_days']);
            $otp=$pdo->prepare("DELETE FROM tamiran_sms_otps WHERE shop_id=:shop AND created_at<DATE_SUB(NOW(),INTERVAL {$otpDays} DAY)");
            $otp->execute(['shop'=>$shopId]);
            $draft=$pdo->prepare("DELETE FROM repair_reception_drafts WHERE shop_id=:shop AND (status IN ('submitted','discarded','expired') OR expires_at<NOW() OR updated_at<DATE_SUB(NOW(),INTERVAL {$draftDays} DAY))");
            $draft->execute(['shop'=>$shopId]);
            $sms=$pdo->prepare("DELETE FROM tamiran_sms_messages WHERE shop_id=:shop AND status IN ('sent','delivered','failed','cancelled') AND created_at<DATE_SUB(NOW(),INTERVAL {$smsDays} DAY)");
            $sms->execute(['shop'=>$shopId]);
            $secret=$pdo->prepare('UPDATE repair_case_workflows SET temporary_device_secret_ciphertext=NULL,temporary_secret_deleted_at=COALESCE(temporary_secret_deleted_at,NOW()) WHERE shop_id=:shop AND temporary_device_secret_ciphertext IS NOT NULL AND (temporary_secret_expires_at<NOW() OR (locked_at IS NOT NULL AND :delete_on_delivery=1))');
            $secret->execute(['shop'=>$shopId,'delete_on_delivery'=>(int)$policy['device_secret_delete_on_delivery']]);
            $result=['otpDeleted'=>$otp->rowCount(),'draftsDeleted'=>$draft->rowCount(),'smsLogsDeleted'=>$sms->rowCount(),'deviceSecretsDeleted'=>$secret->rowCount()];
            $pdo->prepare("UPDATE tamiran_retention_runs SET status='completed',result_json=:result,completed_at=NOW() WHERE public_id=:public")
                ->execute(['result'=>json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'public'=>$runPublic]);
            $pdo->commit();$results[]=['shopId'=>$shopId]+$result;
        }catch(Throwable $error){
            if($pdo->inTransaction())$pdo->rollBack();
            $pdo->prepare("UPDATE tamiran_retention_runs SET status='failed',result_json=:result,completed_at=NOW() WHERE public_id=:public")
                ->execute(['result'=>json_encode(['error'=>tamiran_request_id()],JSON_THROW_ON_ERROR),'public'=>$runPublic]);
            tamiran_log('error','retention_worker_failed',['shop_id'=>$shopId,'message'=>$error->getMessage()]);
            $results[]=['shopId'=>$shopId,'failed'=>true,'trackingCode'=>tamiran_request_id()];
        }
    }
    return['shops'=>count($policies),'results'=>$results];
});
