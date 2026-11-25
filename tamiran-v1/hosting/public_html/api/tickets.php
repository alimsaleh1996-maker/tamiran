<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function ticket_text(mixed $value, string $label, int $maxLength, bool $required = true): string
{
    $text = trim((string) $value);
    if ($required && $text === '') throw new TamiranApiException("{$label} الزامی است.");
    $length = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
    if ($length > $maxLength) throw new TamiranApiException("{$label} بیش از حد طولانی است.");
    return $text;
}

function ticket_require_access(array $actor): ?int
{
    if (($actor['role'] ?? '') === 'central_admin') return null;
    if (($actor['role'] ?? '') !== 'repair_manager' || !is_array($actor['shop'] ?? null)) {
        throw new TamiranApiException('تیکت پشتیبانی فقط برای مدیر تعمیرگاه و مدیر مرکزی در دسترس است.', 403);
    }
    return (int) $actor['shop']['id'];
}

tamiran_api(static function (): array {
    $actor = tamiran_require_actor();
    $shopId = ticket_require_access($actor);
    $central = $shopId === null;
    $pdo = tamiran_db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $sql =
            'SELECT t.public_id,t.category,t.priority,t.subject,t.status,t.created_at,t.updated_at,
                    s.name AS shop_name,u.display_name AS created_by
             FROM repair_support_tickets t
             INNER JOIN repair_shops s ON s.id=t.shop_id
             INNER JOIN tamiran_users u ON u.id=t.created_by_user_id'
            . ($central ? '' : ' WHERE t.shop_id=:shop_id')
            . ' ORDER BY t.updated_at DESC,t.id DESC LIMIT 150';
        $statement = $pdo->prepare($sql);
        $statement->execute($central ? [] : ['shop_id'=>$shopId]);
        $tickets = $statement->fetchAll();
        if ($tickets !== []) {
            $ids = [];
            $lookup = [];
            foreach ($tickets as $index => $ticket) {
                $ids[] = $ticket['public_id'];
                $lookup[$ticket['public_id']] = $index;
                $tickets[$index]['messages'] = [];
            }
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $messages = $pdo->prepare(
                "SELECT t.public_id,m.id,m.body,m.created_at,u.display_name AS author_name
                 FROM repair_support_ticket_messages m
                 INNER JOIN repair_support_tickets t ON t.id=m.ticket_id
                 INNER JOIN tamiran_users u ON u.id=m.author_user_id
                 WHERE t.public_id IN ({$marks}) ORDER BY m.created_at,m.id"
            );
            $messages->execute($ids);
            foreach ($messages->fetchAll() as $message) {
                $publicId = $message['public_id'];
                unset($message['public_id']);
                $tickets[$lookup[$publicId]]['messages'][] = $message;
            }
        }
        return ['tickets'=>$tickets];
    }

    tamiran_require_csrf();
    $input = tamiran_json_body();

    if ($method === 'POST') {
        if ($central) {
            $shopId = (int) ($input['shopId'] ?? 0);
            if ($shopId < 1) throw new TamiranApiException('تعمیرگاه تیکت را مشخص کنید.');
            $shopCheck = $pdo->prepare('SELECT id FROM repair_shops WHERE id=:id LIMIT 1');
            $shopCheck->execute(['id'=>$shopId]);
            if ($shopCheck->fetchColumn() === false) throw new TamiranApiException('تعمیرگاه پیدا نشد.', 404);
        }
        $category = ticket_text($input['category'] ?? '', 'دسته تیکت', 32);
        if (!in_array($category, ['support','incident','sales'], true)) throw new TamiranApiException('دسته تیکت معتبر نیست.');
        $priority = (string) ($input['priority'] ?? 'normal');
        if (!in_array($priority, ['normal','important','urgent'], true)) $priority = 'normal';
        $subject = ticket_text($input['subject'] ?? '', 'عنوان تیکت', 220);
        $message = ticket_text($input['message'] ?? '', 'شرح تیکت', 8000);
        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare(
                'INSERT INTO repair_support_tickets(public_id,shop_id,category,priority,subject,created_by_user_id)
                 VALUES(:id,:shop,:category,:priority,:subject,:user)'
            );
            $statement->execute(['id'=>tamiran_id(),'shop'=>$shopId,'category'=>$category,'priority'=>$priority,'subject'=>$subject,'user'=>$actor['id']]);
            $ticketId = (int) $pdo->lastInsertId();
            $pdo->prepare('INSERT INTO repair_support_ticket_messages(ticket_id,author_user_id,body) VALUES(:ticket,:user,:body)')
                ->execute(['ticket'=>$ticketId,'user'=>$actor['id'],'body'=>$message]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        tamiran_log('info', 'support_ticket_created', ['shop_id'=>$shopId, 'actor_id'=>$actor['id']]);
        return ['created'=>true];
    }

    if ($method === 'PATCH') {
        $publicId = ticket_text($input['publicId'] ?? '', 'شناسه تیکت', 80);
        $sql = 'SELECT id,shop_id FROM repair_support_tickets WHERE public_id=:id' . ($central ? '' : ' AND shop_id=:shop') . ' LIMIT 1';
        $statement = $pdo->prepare($sql);
        $params = ['id'=>$publicId];
        if (!$central) $params['shop'] = $shopId;
        $statement->execute($params);
        $ticket = $statement->fetch();
        if (!is_array($ticket)) throw new TamiranApiException('تیکت پیدا نشد.', 404);

        if (array_key_exists('status', $input)) {
            if (!$central) throw new TamiranApiException('تغییر وضعیت تیکت فقط برای مدیر مرکزی مجاز است.', 403);
            $status = (string) $input['status'];
            if (!in_array($status, ['open','in_progress','waiting_shop','resolved','closed'], true)) throw new TamiranApiException('وضعیت معتبر نیست.');
            $pdo->prepare('UPDATE repair_support_tickets SET status=:status WHERE id=:id')->execute(['status'=>$status,'id'=>$ticket['id']]);
        }
        $message = ticket_text($input['message'] ?? '', 'متن پاسخ', 8000, false);
        if ($message !== '') {
            $pdo->prepare('INSERT INTO repair_support_ticket_messages(ticket_id,author_user_id,body) VALUES(:ticket,:user,:body)')
                ->execute(['ticket'=>$ticket['id'],'user'=>$actor['id'],'body'=>$message]);
        }
        if (!array_key_exists('status', $input) && $message === '') throw new TamiranApiException('هیچ تغییری برای ثبت ارسال نشده است.');
        tamiran_log('info', 'support_ticket_updated', ['ticket_id'=>$ticket['id'], 'actor_id'=>$actor['id']]);
        return ['updated'=>true];
    }

    throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
});
