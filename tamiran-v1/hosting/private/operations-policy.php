<?php
declare(strict_types=1);

function operations_policy_defaults(): array
{
    return [
        'handover'=>'direct', 'approval'=>'both', 'purchase'=>'approval', 'purchaseLimits'=>[],
        'followHours'=>['customer'=>24, 'parts'=>72, 'pickup'=>168, 'receipt'=>24],
        'hotReturnHours'=>168, 'paymentMethods'=>['cash','card','bank_transfer','online','credit'],
        'reasons'=>[
            ['id'=>'absence','title'=>'عدم حضور یا مرخصی تکنسین','active'=>true],
            ['id'=>'capacity','title'=>'حجم بالای کار','active'=>true],
            ['id'=>'duration','title'=>'زمان‌بر بودن تعمیر','active'=>true],
            ['id'=>'ability','title'=>'عدم توانایی در تعمیر','active'=>true],
            ['id'=>'expertise','title'=>'نیاز به تخصص تکنسین دیگر','active'=>true],
            ['id'=>'equipment','title'=>'عدم دسترسی به تجهیزات','active'=>true],
            ['id'=>'unsuccessful','title'=>'عدم موفقیت در تعمیر','active'=>true],
            ['id'=>'priority','title'=>'تغییر اولویت تعمیرات','active'=>true],
            ['id'=>'manager','title'=>'تصمیم مدیر تعمیرگاه','active'=>true],
            ['id'=>'other','title'=>'سایر موارد','active'=>true],
        ],
    ];
}

function operations_policy(PDO $pdo, int $shop): array
{
    $query=$pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='operations_policy'");
    $query->execute(['shop'=>$shop]);
    $stored=json_decode((string)$query->fetchColumn(),true);
    return operations_policy_with_defaults(is_array($stored)?$stored:[]);
}

function operations_policy_with_defaults(array $input): array
{
    $default=operations_policy_defaults();
    $data=array_replace($default,$input);
    if (is_array($data['followHours'])) $data['followHours']=array_replace($default['followHours'],$data['followHours']);
    return $data;
}

function operations_policy_validate(mixed $input): array
{
    if (!is_array($input)) throw new TamiranApiException('تنظیمات عملیات معتبر نیست.');
    $data=operations_policy_with_defaults($input);
    if (!in_array($data['handover'],['direct','manager','disabled'],true)
        || !in_array($data['approval'],['both','phone','sms'],true)
        || !in_array($data['purchase'],['free','approval','limit'],true)) {
        throw new TamiranApiException('سیاست ارجاع یا خرید معتبر نیست.');
    }
    foreach (['purchaseLimits','followHours','reasons'] as $key) {
        if (!is_array($data[$key])) throw new TamiranApiException('تنظیمات عملیات معتبر نیست.');
    }
    if (count($data['purchaseLimits'])>500 || count($data['reasons'])>100) {
        throw new TamiranApiException('تعداد ردیف‌های تنظیمات از حد مجاز بیشتر است.');
    }
    $limits=[];
    foreach($data['purchaseLimits'] as $id=>$limit){
        if (!preg_match('/^[1-9][0-9]*$/D',(string)$id)) throw new TamiranApiException('شناسه تکنسین معتبر نیست.');
        $limits[(int)$id]=technician_money($limit);
    }
    $hours=[];
    foreach(['customer','parts','pickup','receipt'] as $key){
        $value=filter_var($data['followHours'][$key]??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>8760]]);
        if ($value===false) throw new TamiranApiException('حد پیگیری باید بین یک ساعت و یک سال باشد.');
        $hours[$key]=$value;
    }
    $hotHours=filter_var($data['hotReturnHours'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>8760]]);
    if ($hotHours===false) throw new TamiranApiException('مهلت داغی باید بین یک ساعت و یک سال باشد.');
    $methods=$data['paymentMethods'];
    $validMethods=operations_policy_defaults()['paymentMethods'];
    if (!is_array($methods)||!array_is_list($methods)||$methods===[]||count($methods)>count($validMethods)) {
        throw new TamiranApiException('حداقل یک روش پرداخت معتبر انتخاب کنید.');
    }
    foreach ($methods as $method) {
        if (!in_array($method,$validMethods,true)) throw new TamiranApiException('روش پرداخت معتبر نیست.');
    }
    $methods=array_values(array_unique($methods));
    $reasons=[];
    foreach($data['reasons'] as $item){
        if (!is_array($item)) throw new TamiranApiException('علت ارجاع معتبر نیست.');
        $id=$item['id']??'';
        if (!is_string($id) || !preg_match('/^[a-z0-9_-]{1,48}$/D',$id) || isset($reasons[$id])) {
            throw new TamiranApiException('شناسه علت ارجاع معتبر یا یکتا نیست.');
        }
        $reasons[$id]=['id'=>$id,'title'=>v2_text($item['title']??'','علت ارجاع',180),'active'=>$id==='other'||!empty($item['active'])];
    }
    $reasons['other']??=['id'=>'other','title'=>'سایر موارد','active'=>true];
    return ['handover'=>$data['handover'],'approval'=>$data['approval'],'purchase'=>$data['purchase'],'purchaseLimits'=>$limits,'followHours'=>$hours,'hotReturnHours'=>$hotHours,'paymentMethods'=>$methods,'reasons'=>array_values($reasons)];
}


/** Read a private setting within the authenticated workshop. */
function operations_intake_setting(PDO $pdo,int $shop,string $key):array
{
    $query=$pdo->prepare('SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key=:key');
    $query->execute(['shop'=>$shop,'key'=>$key]);
    return json_decode((string)$query->fetchColumn(),true) ?: [];
}

function operations_intake_cost_policy(array $template):?array
{
    $policy=$template['costApproval']??null;
    if (!is_array($policy)) return null;
    $mode=$policy['mode']??null;
    if (!in_array($mode,['always','limit'],true)) throw new TamiranApiException('سیاست تأیید هزینه معتبر نیست.');
    $limit=technician_money($policy['limit']??0);
    if ($mode==='limit' && $limit<1) throw new TamiranApiException('سقف موافقت مشتری باید بیشتر از صفر باشد.');
    return ['mode'=>$mode,'limit'=>$mode==='limit'?$limit:0,
        'alwaysText'=>v2_text($policy['alwaysText']??'','متن تأیید هزینه',2000),
        'limitText'=>v2_text($policy['limitText']??'','متن سقف هزینه',2000)];
}

function operations_intake_locations(PDO $pdo,int $shop,int $branch):array
{
    return operations_intake_setting($pdo,$shop,'intake_locations')[(string)$branch]??[];
}

function operations_validate_intake_locations(mixed $input):array
{
    if (!is_array($input)||!array_is_list($input)||count($input)>80) throw new TamiranApiException('فهرست محل‌های دریافت معتبر نیست.');
    $locations=[];
    foreach ($input as $item) {
        if (!is_array($item)) throw new TamiranApiException('محل دریافت معتبر نیست.');
        $id=v2_text($item['id']??'','شناسه محل دریافت',80);
        $method=$item['method']??null;
        if (isset($locations[$id])||!in_array($method,['card','cash','bank_transfer'],true)) throw new TamiranApiException('شناسه یا نوع محل دریافت معتبر نیست.');
        $locations[$id]=['id'=>$id,'method'=>$method,'active'=>($item['active']??false)===true,'label'=>v2_text($item['label']??'','عنوان محل دریافت',100)];
        if ($method !== 'cash') $locations[$id]['bank']=v2_text($item['bank']??'','نام بانک',80);
        if ($method === 'card') {
            $locations[$id]['terminal']=v2_text($item['terminal']??'','شماره پایانه',40);
            $locations[$id]['accountId']=v2_text($item['accountId']??'','حساب متصل',80);
        }
        if ($method === 'bank_transfer') {
            foreach (['account','card','iban'] as $field) $locations[$id][$field]=v2_text($item[$field]??'','شناسه حساب',40,false);
            if (!$locations[$id]['account']&&!$locations[$id]['card']&&!$locations[$id]['iban']) throw new TamiranApiException('یکی از شناسه‌های حساب بانکی را وارد کنید.');
        }
    }
    foreach ($locations as $item) {
        if ($item['method']!=='card') continue;
        $bank=$locations[$item['accountId']]??null;
        if (($bank['method']??null)!=='bank_transfer'||($item['active']&&!$bank['active'])) throw new TamiranApiException('حساب بانکی متصل به کارت‌خوان را بررسی کنید.');
    }
    return array_values($locations);
}
