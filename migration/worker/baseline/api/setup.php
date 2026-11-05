<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

tamiran_api(static function (): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
    $config = tamiran_config();
    $token = trim((string) ($_SERVER['HTTP_X_SETUP_TOKEN'] ?? ''));
    $expectedToken = trim((string) ($config['setup_token'] ?? ''));
    if (!tamiran_secret_is_configured($expectedToken)) throw new TamiranApiException('ابتدا یک توکن تصادفی واقعی در private/config.php تنظیم کنید.', 503);
    if (!hash_equals($expectedToken, $token)) throw new TamiranApiException('توکن راه‌اندازی معتبر نیست.', 403);
    $input = tamiran_json_body();
    $mobile = tamiran_mobile((string) ($input['mobile'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    $name = trim((string) ($input['displayName'] ?? 'ادمین تعمیران'));
    $nameLength = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
    if ($name === '' || $nameLength > 180) throw new TamiranApiException('نام نمایشی معتبر نیست.');
    tamiran_validate_new_password($password);
    $pdo = tamiran_db();
    $existing = $pdo->query("SELECT id,username,phone FROM tamiran_users WHERE shop_id IS NULL AND role_code='central_admin' ORDER BY id LIMIT 1")->fetch();
    $event = 'central_admin_initialized';
    if (is_array($existing)) {
        $legacyMobile = tamiran_digits((string) ($existing['phone'] ?: $existing['username']));
        if (preg_match('/^09\d{9}$/', $legacyMobile)) {
            if (!hash_equals($legacyMobile, $mobile)) throw new TamiranApiException('شماره موبایل واردشده با مدیر مرکزی فعلی مطابقت ندارد.', 403);
            $stmt = $pdo->prepare('UPDATE tamiran_users SET display_name=:name,password_hash=:password_hash,is_active=1 WHERE id=:id');
            $stmt->execute(['id'=>(int)$existing['id'],'name'=>$name,'password_hash'=>tamiran_password_hash($password)]);
            $userId = (int) $existing['id'];
            $event = 'central_admin_password_reset';
            $message = 'رمز مدیر مرکزی بازنشانی شد؛ اکنون با رمز جدید وارد شوید.';
        } else {
            $duplicate = $pdo->prepare('SELECT id FROM tamiran_users WHERE (username=:username OR phone=:phone) AND id<>:except LIMIT 1');
            $duplicate->execute(['username'=>$mobile, 'phone'=>$mobile, 'except'=>(int)$existing['id']]);
            if ($duplicate->fetchColumn() !== false) throw new TamiranApiException('این شماره موبایل برای حساب دیگری ثبت شده است.', 409);
            $stmt = $pdo->prepare('UPDATE tamiran_users SET username=:username,display_name=:name,phone=:phone,password_hash=:password_hash,is_active=1 WHERE id=:id');
            $stmt->execute(['id'=>(int)$existing['id'],'username'=>$mobile,'name'=>$name,'phone'=>$mobile,'password_hash'=>tamiran_password_hash($password)]);
            $userId = (int) $existing['id'];
            $message = 'حساب قدیمی مدیر مرکزی به ورود با شماره موبایل ارتقا یافت.';
        }
    } else {
        $duplicate = $pdo->prepare('SELECT id FROM tamiran_users WHERE username=:username OR phone=:phone LIMIT 1');
        $duplicate->execute(['username'=>$mobile, 'phone'=>$mobile]);
        if ($duplicate->fetchColumn() !== false) throw new TamiranApiException('این شماره موبایل برای حساب دیگری ثبت شده است.', 409);
        $stmt = $pdo->prepare("INSERT INTO tamiran_users (shop_id, username, display_name, phone, password_hash, role_code) VALUES (NULL, :username, :name, :phone, :password_hash, 'central_admin')");
        $stmt->execute(['username'=>$mobile, 'name'=>$name, 'phone'=>$mobile, 'password_hash'=>tamiran_password_hash($password)]);
        $userId = (int) $pdo->lastInsertId();
        $message = 'ادمین مرکزی تعمیران ساخته شد.';
    }
    tamiran_verify_stored_password($pdo, $userId, $password);
    tamiran_log('info', $event, ['user_id'=>$userId]);
    return ['message'=>$message];
});
