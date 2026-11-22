<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
require_once tamiran_private_root().'/v2-core.php';
try{
    tamiran_require_https();$applicationLock=fopen(tamiran_private_root().'/application.lock','c');
    if($applicationLock===false||!flock($applicationLock,LOCK_SH|LOCK_NB))throw new TamiranApiException('سامانه در حال بازیابی است.',503);
    $pdo=tamiran_db();$scope=v2_scope();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){
        if(isset($_GET['caseId'])){
            $case=v2_case($pdo,$scope,(int)$_GET['caseId']);v2_require_case_access($pdo,$scope,$case);
            $private=in_array($scope['role'],['repair_manager','reception'],true)&&($_GET['technical']??'')!=='1'?'':" AND f.purpose NOT IN ('identity','signature')";
            $statement=$pdo->prepare("SELECT f.public_id AS publicId,f.original_name AS originalName,f.mime_type AS mimeType,f.size_bytes AS sizeBytes,f.created_at AS createdAt,f.purpose,u.display_name AS uploadedBy FROM tamiran_private_files f LEFT JOIN tamiran_users u ON u.id=f.uploaded_by_user_id WHERE f.case_id=:case AND f.shop_id=:shop AND f.branch_id=:branch {$private} ORDER BY f.id DESC LIMIT 100");
            $statement->execute(['case'=>$case['case_id'],'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);tamiran_respond(['files'=>$statement->fetchAll()]);exit;
        }
        $public=v2_text($_GET['id']??'','فایل',80);$statement=$pdo->prepare('SELECT * FROM tamiran_private_files WHERE public_id=:public AND shop_id=:shop AND branch_id=:branch LIMIT 1');$statement->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$file=$statement->fetch();
        if(!is_array($file))throw new TamiranApiException('فایل پیدا نشد.',404);
        if($file['case_id']!==null){$case=v2_case($pdo,$scope,(int)$file['case_id']);v2_require_case_access($pdo,$scope,$case);}elseif($scope['role']==='technician')throw new TamiranApiException('فایل به پرونده مجاز شما متصل نیست.',403);
        if(in_array($file['purpose'],['identity','signature'],true)&&!in_array($scope['role'],['repair_manager','reception'],true))throw new TamiranApiException('مشاهده مدرک هویتی مجاز نیست.',403);
        $real=realpath(tamiran_private_root().'/files/'.$file['storage_key']);$root=realpath(tamiran_private_root().'/files');
        if(!is_string($real)||!is_string($root)||!str_starts_with($real,$root.DIRECTORY_SEPARATOR)||!is_file($real))throw new TamiranApiException('فایل ذخیره‌شده در دسترس نیست.',404);
        header('Content-Type: '.$file['mime_type']);header('Content-Length: '.filesize($real));header('Content-Disposition: inline; filename="'.preg_replace('/[^A-Za-z0-9._-]/','_',basename((string)$file['original_name'])).'"');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('X-Request-ID: '.tamiran_request_id());tamiran_log_response(200);readfile($real);exit;
    }
    if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);tamiran_require_csrf();
    if(!isset($_FILES['file'])||!is_array($_FILES['file'])||($_FILES['file']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)throw new TamiranApiException('فایل معتبر ارسال نشده است.');
    $upload=$_FILES['file'];$size=(int)($upload['size']??0);if($size<1||$size>15*1024*1024)throw new TamiranApiException('حجم فایل باید حداکثر ۱۵ مگابایت باشد.',413);
    $temporary=(string)$upload['tmp_name'];if(!is_uploaded_file($temporary))throw new TamiranApiException('بارگذاری فایل معتبر نیست.');$mime=(string)(new finfo(FILEINFO_MIME_TYPE))->file($temporary);
    if(!in_array($mime,['image/jpeg','image/png','image/webp','application/pdf'],true))throw new TamiranApiException('فقط عکس JPEG، PNG، WebP یا PDF مجاز است.',422);
    $purpose=(string)($_POST['purpose']??'other');if(!in_array($purpose,['reception','qc','hot_return','purchase','signature','identity','other'],true))throw new TamiranApiException('کاربرد فایل معتبر نیست.');
    if(in_array($purpose,['identity','signature'],true)&&!in_array($scope['role'],['repair_manager','reception'],true))throw new TamiranApiException('ثبت مدرک هویتی فقط برای مدیر یا پذیرش مجاز است.',403);
    $caseId=(int)($_POST['caseId']??0)?:null;if($caseId===null&&$scope['role']==='technician')throw new TamiranApiException('ثبت عکس به پرونده مشخص نیاز دارد.',422);
    $sha=hash_file('sha256',$temporary);if(!is_string($sha))throw new TamiranApiException('محاسبه اثر انگشت فایل انجام نشد.',500);
    $target=null;$pdo->beginTransaction();
    try{
        if($caseId!==null){$case=v2_case($pdo,$scope,$caseId,true);v2_require_case_access($pdo,$scope,$case);if($scope['role']==='technician'&&$case['locked_at']!==null)throw new TamiranApiException('ثبت عکس در پرونده مختومه مجاز نیست.',409);}
        $relative=$scope['shop_id'].'/'.substr($sha,0,2).'/'.bin2hex(random_bytes(20));$directory=dirname(tamiran_private_root().'/files/'.$relative);if(!is_dir($directory)&&!mkdir($directory,0770,true)&&!is_dir($directory))throw new TamiranApiException('ساخت فضای خصوصی فایل انجام نشد.',500);
        $target=tamiran_private_root().'/files/'.$relative;if(!move_uploaded_file($temporary,$target))throw new TamiranApiException('ذخیره فایل انجام نشد.',500);chmod($target,0660);$public=tamiran_id();
        $pdo->prepare("INSERT INTO tamiran_private_files(public_id,shop_id,branch_id,case_id,storage_driver,storage_key,original_name,mime_type,size_bytes,sha256,purpose,is_customer_visible,uploaded_by_user_id) VALUES(:public,:shop,:branch,:case,'private_host',:key,:name,:mime,:size,:sha,:purpose,0,:actor)")->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId,'key'=>$relative,'name'=>mb_substr((string)($upload['name']??'file'),0,240),'mime'=>$mime,'size'=>$size,'sha'=>$sha,'purpose'=>$purpose,'actor'=>$scope['actor']['id']]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.file_upload','private_file',$public,null,['caseId'=>$caseId,'mimeType'=>$mime,'sizeBytes'=>$size,'sha256'=>$sha]);$pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($target!==null)@unlink($target);throw $e;}
    tamiran_respond(['publicId'=>$public,'mimeType'=>$mime,'sizeBytes'=>$size,'sha256'=>$sha]);
}catch(Throwable $e){tamiran_fail($e);}
