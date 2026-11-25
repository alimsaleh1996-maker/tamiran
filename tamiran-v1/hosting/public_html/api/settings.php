<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

tamiran_api(static function(): array {
    $actor = tamiran_require_actor();
    if (($actor['role'] ?? '') === 'central_admin' || !is_array($actor['shop'] ?? null)) throw new TamiranApiException('تنظیمات هر تعمیرگاه از فضای خودش خوانده می‌شود.', 403);
    $shopId = (int)$actor['shop']['id'];
    $pdo = tamiran_db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $shopStatement = $pdo->prepare('SELECT * FROM repair_shops WHERE id=:id');
    $shopStatement->execute(['id'=>$shopId]);
    $shop = $shopStatement->fetch();
    if(!is_array($shop))throw new TamiranApiException('تعمیرگاه پیدا نشد.',404);
    if ($method === 'GET') {
        $settingsStatement = $pdo->prepare('SELECT setting_key,value_json FROM repair_shop_settings WHERE shop_id=:shop');
        $settingsStatement->execute(['shop'=>$shopId]);
        $settings = [];
        foreach ($settingsStatement->fetchAll() as $row) {
            $decoded = json_decode((string)$row['value_json'], true);
            $settings[(string)$row['setting_key']] = $decoded;
        }
        $termStatement=$pdo->prepare('SELECT public_id,version_number,title,body_text,content_sha256,effective_from FROM repair_receipt_term_versions WHERE shop_id=:shop AND is_active=1 AND effective_from<=NOW() AND (effective_to IS NULL OR effective_to>NOW()) ORDER BY version_number DESC LIMIT 1');
        $termStatement->execute(['shop'=>$shopId]);
        return ['shop'=>[
            'name'=>$shop['name'],'code'=>$shop['shop_code'],'repairType'=>$shop['repair_type'],'typeLocked'=>(bool)$shop['repair_type_locked'],
            'nationalCodeRequired'=>(bool)$shop['national_code_required'],'plan'=>$shop['plan_code'],'expiresAt'=>$shop['license_expires_at'],
            'operationMode'=>$shop['operation_mode'],'inventoryCostMethod'=>$shop['inventory_cost_method'],
            'productProfile'=>$shop['product_profile'],'inventoryMode'=>$shop['inventory_mode'],'qcMode'=>$shop['qc_mode'],
            'featureFlags'=>json_decode((string)$shop['feature_flags_json'],true)?:[],
            'allowSelfQc'=>(bool)$shop['allow_self_qc'],'allowDeliveryWithBalance'=>(bool)$shop['allow_delivery_with_balance'],
            'workflowSettings'=>json_decode((string)$shop['workflow_settings_json'],true)?:[],
            'taxSettings'=>json_decode((string)$shop['tax_settings_json'],true)?:[],
            'licenseStatus'=>tamiran_license_state($shop),'modules'=>json_decode((string)$shop['modules_json'],true)?:[],
        ],'settings'=>$settings,'activeReceiptTerms'=>$termStatement->fetch()?:null];
    }
    if ($method === 'PATCH') {
        if (($actor['role'] ?? '') !== 'repair_manager') throw new TamiranApiException('تغییر تنظیمات فقط برای مدیر تعمیرگاه مجاز است.', 403);
        tamiran_require_csrf();
        tamiran_require_writable_actor($actor);
        $input = tamiran_json_body();
        if (array_key_exists('repairType',$input)) throw new TamiranApiException('نوع تعمیرگاه بعد از تعریف قفل است.',409);
        if (array_key_exists('nationalCodeRequired',$input)) {
            $pdo->prepare('UPDATE repair_shops SET national_code_required=:required WHERE id=:id')->execute(['id'=>$shopId,'required'=>!empty($input['nationalCodeRequired'])?1:0]);
        }
        $direct=[];
        if(array_key_exists('operationMode',$input)){if(!in_array($input['operationMode'],['single_user','multi_user'],true))throw new TamiranApiException('حالت عملیاتی معتبر نیست.');$direct['operation_mode']=$input['operationMode'];}
        if(array_key_exists('inventoryMode',$input)){if(!in_array($input['inventoryMode'],['off','simple','pro'],true))throw new TamiranApiException('سطح انبار معتبر نیست.');if($shop['product_profile']==='solo'&&$input['inventoryMode']==='pro')throw new TamiranApiException('Inventory Pro در تعمیران Solo فعال نمی‌شود.',409);$direct['inventory_mode']=$input['inventoryMode'];}
        if(array_key_exists('qcMode',$input)){if(!in_array($input['qcMode'],['off','simple','independent'],true))throw new TamiranApiException('سطح کنترل کیفیت معتبر نیست.');if($shop['product_profile']==='solo'&&$input['qcMode']==='independent')throw new TamiranApiException('QC مستقل در تعمیران Solo فعال نمی‌شود.',409);$direct['qc_mode']=$input['qcMode'];}
        if(array_key_exists('inventoryCostMethod',$input)){if(!in_array($input['inventoryCostMethod'],['weighted_average','fifo','last_purchase'],true))throw new TamiranApiException('روش قیمت تمام‌شده معتبر نیست.');$direct['inventory_cost_method']=$input['inventoryCostMethod'];}
        if(array_key_exists('allowSelfQc',$input))$direct['allow_self_qc']=!empty($input['allowSelfQc'])?1:0;
        if(array_key_exists('allowDeliveryWithBalance',$input))$direct['allow_delivery_with_balance']=!empty($input['allowDeliveryWithBalance'])?1:0;
        if($direct!==[]){$parts=[];$params=['id'=>$shopId];foreach($direct as$key=>$value){$parts[]="{$key}=:{$key}";$params[$key]=$value;}$pdo->prepare('UPDATE repair_shops SET '.implode(',',$parts).' WHERE id=:id')->execute($params);tamiran_audit($pdo,$shopId,(int)($actor['branch']['id']??0),(int)$actor['id'],'settings.operation.update','repair_shop',(string)$shop['public_id'],null,$direct,'به‌روزرسانی تنظیمات عملیاتی نسخه ۲');}
        if(array_key_exists('receiptTerms',$input)){
            if(!is_array($input['receiptTerms']))throw new TamiranApiException('شرایط پذیرش معتبر نیست.');
            $title=trim((string)($input['receiptTerms']['title']??''));$body=trim((string)($input['receiptTerms']['body']??''));
            if($title===''||strlen($title)>720||$body===''||strlen($body)>40000)throw new TamiranApiException('عنوان یا متن شرایط پذیرش معتبر نیست.');
            $pdo->beginTransaction();
            try{
                $version=$pdo->prepare('SELECT COALESCE(MAX(version_number),0)+1 FROM repair_receipt_term_versions WHERE shop_id=:shop FOR UPDATE');
                $version->execute(['shop'=>$shopId]);$next=(int)$version->fetchColumn();
                $pdo->prepare('UPDATE repair_receipt_term_versions SET is_active=0,effective_to=NOW() WHERE shop_id=:shop AND is_active=1')->execute(['shop'=>$shopId]);
                $public=tamiran_id();
                $pdo->prepare('INSERT INTO repair_receipt_term_versions(public_id,shop_id,version_number,title,body_text,content_sha256,is_active,created_by_user_id) VALUES(:public,:shop,:version,:title,:body,:hash,1,:actor)')->execute(['public'=>$public,'shop'=>$shopId,'version'=>$next,'title'=>$title,'body'=>$body,'hash'=>hash('sha256',$body),'actor'=>$actor['id']]);
                tamiran_audit($pdo,$shopId,(int)($actor['branch']['id']??0),(int)$actor['id'],'receipt_terms.version.create','repair_receipt_term_version',$public,null,['version'=>$next,'contentSha256'=>hash('sha256',$body)],'نسخه جدید شرایط پذیرش');
                $pdo->commit();
            }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
        }
        if (array_key_exists('key',$input)) {
            $key = trim((string)$input['key']);
            $allowed = ['receipt_template','service_forms','customer_address_policy','inventory_policy','security_policy','assignment_policy','delivery_verification','reception_evidence','warranty_policy','technician_compensation','sla_policy','sms_events','device_colors'];
            if (!in_array($key,$allowed,true)) throw new TamiranApiException('کلید تنظیمات معتبر نیست.');
            if (!array_key_exists('value',$input)) throw new TamiranApiException('مقدار تنظیمات ارسال نشده است.');
            if ($key === 'assignment_policy') {
                if (!is_array($input['value'])) throw new TamiranApiException('تنظیم تخصیص تکنسین معتبر نیست.');
                $branchId = (int)($actor['branch']['id'] ?? 0);
                if ($branchId < 1) throw new TamiranApiException('شعبه جاری برای ذخیره تنظیم تکنسین معتبر نیست.', 409);
                $defaultTechnicianId = (int)($input['value']['defaultTechnicianId'] ?? 0);
                if ($defaultTechnicianId > 0) {
                    $technician = $pdo->prepare(
                        "SELECT u.id FROM tamiran_users u
                         INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.branch_id=:branch
                         WHERE u.id=:id AND u.shop_id=:shop AND u.is_active=1
                           AND u.role_code IN ('technician','repair_manager') LIMIT 1"
                    );
                    $technician->execute(['id'=>$defaultTechnicianId,'shop'=>$shopId,'branch'=>$branchId]);
                    if (!(int)$technician->fetchColumn()) throw new TamiranApiException('تکنسین پیش‌فرض باید کاربر فعال همین شعبه باشد.', 409);
                }
                $currentStatement = $pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='assignment_policy' LIMIT 1");
                $currentStatement->execute(['shop'=>$shopId]);
                $current = json_decode((string)($currentStatement->fetchColumn() ?: ''), true);
                if (!is_array($current)) $current = [];
                if (!is_array($current['branches'] ?? null)) $current['branches'] = [];
                $current['branches'][(string)$branchId] = [
                    'defaultTechnicianId'=>$defaultTechnicianId > 0 ? $defaultTechnicianId : null,
                    'autoAssignSingleTechnician'=>!array_key_exists('autoAssignSingleTechnician', $input['value']) || !empty($input['value']['autoAssignSingleTechnician']),
                ];
                $input['value'] = $current;
            }
            if($key==='delivery_verification'){
                if(!is_array($input['value']))throw new TamiranApiException('تنظیم احراز تحویل معتبر نیست.');$enabled=array_values(array_intersect((array)($input['value']['enabledMethods']??[]),['digital_signature','identity_document','sms_otp','receipt_qr']));if($enabled===[])throw new TamiranApiException('حداقل یک روش احراز تحویل باید فعال باشد.');$input['value']['enabledMethods']=$enabled;$input['value']['minimumEvidenceCount']=max(1,min(count($enabled),(int)($input['value']['minimumEvidenceCount']??1)));
            }
            if($key==='device_colors'){
                if(!is_array($input['value'])||count($input['value'])<1||count($input['value'])>100)throw new TamiranApiException('فهرست رنگ‌های دستگاه معتبر نیست.');
                $names=[];
                foreach($input['value'] as$index=>$color){
                    if(!is_array($color))throw new TamiranApiException('ساختار یکی از رنگ‌ها معتبر نیست.');
                    $name=trim((string)($color['name']??''));
                    if($name===''||mb_strlen($name)>80)throw new TamiranApiException('نام رنگ الزامی است و حداکثر ۸۰ نویسه دارد.');
                    $normalized=mb_strtolower($name,'UTF-8');
                    if(isset($names[$normalized]))throw new TamiranApiException('نام رنگ تکراری است: '.$name,409);
                    $names[$normalized]=true;
                    $hex=trim((string)($color['hex']??''));
                    if($hex!==''&&!preg_match('/^#[0-9a-fA-F]{6}$/',$hex))throw new TamiranApiException('کد رنگ HEX معتبر نیست.');
                    $input['value'][$index]=['id'=>(string)($color['id']??tamiran_id()),'name'=>$name,'hex'=>$hex?:null,'active'=>($color['active']??true)!==false,'sortOrder'=>max(1,(int)($color['sortOrder']??($index+1)))];
                }
            }
            $encoded = json_encode($input['value'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false || strlen($encoded) > 100000) throw new TamiranApiException('مقدار تنظیمات معتبر نیست یا بیش از حد بزرگ است.');
            $statement = $pdo->prepare(
                'INSERT INTO repair_shop_settings(shop_id,setting_key,value_json,updated_by_user_id) VALUES(:shop,:key,:value,:user)
                 ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_by_user_id=VALUES(updated_by_user_id),updated_at=NOW()'
            );
            $statement->execute(['shop'=>$shopId,'key'=>$key,'value'=>$encoded,'user'=>(int)$actor['id']]);
            if ($key === 'assignment_policy') tamiran_log('info','assignment_policy_updated',['shop_id'=>$shopId,'branch_id'=>(int)$actor['branch']['id'],'actor_id'=>(int)$actor['id']]);
        }
        return ['updated'=>true];
    }
    throw new TamiranApiException('روش درخواست مجاز نیست.',405);
});
