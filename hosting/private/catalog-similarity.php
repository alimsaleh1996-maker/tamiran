<?php
declare(strict_types=1);
/** Same conservative name rules as catalog-similarity.ts. Model numbers are never fuzzy. */
function catalog_text(string $value): string
{
    $value=mb_convert_kana($value,'as','UTF-8');
    $value=strtr($value,array_combine(preg_split('//u','۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789')));
    return preg_replace('/[\x{064b}-\x{065f}\x{0670}\x{0640}\x{200c}\x{200d}]/u','',strtr(mb_strtolower($value),['ي'=>'ی','ى'=>'ی','ك'=>'ک']))??'';
}
function catalog_compact(string $value): string{return preg_replace('/[^\p{L}\p{N}]/u','',catalog_text($value))??'';}
function catalog_type(string $value): string
{
    $key=catalog_compact($value);return ['موبایل'=>'mobile','گوشی'=>'mobile','گوشیموبایل'=>'mobile','mobile'=>'mobile','phone'=>'mobile','smartphone'=>'mobile','موبایلوتبلت'=>'mobile','تبلت'=>'tablet','tablet'=>'tablet','لپتاپ'=>'laptop','رایانه'=>'computer','کامپیوتر'=>'computer','laptop'=>'laptop','notebook'=>'laptop','computer'=>'computer','هندزفری'=>'earbuds','هندسفری'=>'earbuds','handsfree'=>'earbuds','earbuds'=>'earbuds','هدفون'=>'earbuds','headphone'=>'earbuds','headphones'=>'earbuds','ایرباد'=>'earbuds','هدفونبیسیم'=>'earbuds'][$key]??$key;
}
function catalog_brand(string $value): string
{
    $key=catalog_compact($value);return ['سامسونگ'=>'samsung','سامسنگ'=>'samsung','samsung'=>'samsung','اپل'=>'apple','apple'=>'apple','شیائومی'=>'xiaomi','شیاومی'=>'xiaomi','xiaomi'=>'xiaomi','هواوی'=>'huawei','هوآوی'=>'huawei','huawei'=>'huawei','لنوو'=>'lenovo','lenovo'=>'lenovo','ایسوس'=>'asus','asus'=>'asus','اچپی'=>'hp','hp'=>'hp','سونی'=>'sony','sony'=>'sony','جیبیال'=>'jbl','jbl'=>'jbl','نوکیا'=>'nokia','nokia'=>'nokia'][$key]??$key;
}
function catalog_model_signature(string $value,string $brand): array
{
    $text=catalog_text($value);$text=preg_replace(['/ایرپادز?|air\s*pods?/u','/گلکسی/u','/پرو/u','/پلاس/u','/مکس/u','/اولترا|الترا/u'],[' airpods ',' galaxy ',' pro ',' plus ',' max ',' ultra '],$text)??'';
    if(catalog_brand($brand)==='samsung')$text=str_replace('galaxy',' ',$text);
    $text=preg_replace(['/(\p{L})(\p{N})/u','/(\p{N})(\p{L})/u'],['$1 $2','$1 $2'],$text)??'';
    preg_match_all('/[\p{L}\p{N}]+/u',$text,$found);$tokens=$found[0];$sorted=$tokens;sort($sorted,SORT_STRING);preg_match_all('/[0-9]+/',$text,$numbers);sort($numbers[0],SORT_STRING);
    $codes=[];foreach($tokens as $i=>$token)if(preg_match('/^\p{L}{1,3}$/u',$token)&&(preg_match('/^[0-9]+$/',$tokens[$i-1]??'')||preg_match('/^[0-9]+$/',$tokens[$i+1]??'')))$codes[]=$token;sort($codes,SORT_STRING);
    return ['codes'=>implode('|',$codes),'compact'=>implode('',$tokens),'sorted'=>implode('|',$sorted),'digits'=>implode('|',$numbers[0])];
}
function catalog_distance(string $a,string $b): int
{
    $x=preg_split('//u',$a,-1,PREG_SPLIT_NO_EMPTY);$y=preg_split('//u',$b,-1,PREG_SPLIT_NO_EMPTY);$n=count($x);$m=count($y);$d=array_fill(0,$n+1,array_fill(0,$m+1,0));
    for($i=0;$i<=$n;$i++)$d[$i][0]=$i;for($j=0;$j<=$m;$j++)$d[0][$j]=$j;
    for($i=1;$i<=$n;$i++)for($j=1;$j<=$m;$j++){$d[$i][$j]=min($d[$i-1][$j]+1,$d[$i][$j-1]+1,$d[$i-1][$j-1]+($x[$i-1]===$y[$j-1]?0:1));if($i>1&&$j>1&&$x[$i-1]===$y[$j-2]&&$x[$i-2]===$y[$j-1])$d[$i][$j]=min($d[$i][$j],$d[$i-2][$j-2]+1);}
    return $d[$n][$m];
}
function catalog_match(array $a,array $b): ?string
{
    if(catalog_type($a['type'])!==catalog_type($b['type'])||catalog_brand($a['brand'])!==catalog_brand($b['brand']))return null;
    $x=catalog_model_signature($a['model'],$a['brand']);$y=catalog_model_signature($b['model'],$b['brand']);
    if($x['compact']===''||$y['compact']==='')return null;
    if($x['compact']===$y['compact'])return 'identical';
    if($x['digits']!==$y['digits']||$x['codes']!==$y['codes'])return null;
    if($x['sorted']===$y['sorted'])return 'identical';
    if(str_starts_with($x['compact'],$y['compact'])||str_starts_with($y['compact'],$x['compact']))return null;
    $length=max(mb_strlen($x['compact']),mb_strlen($y['compact']));$limit=$length>=12?2:1;
    if(abs(mb_strlen($x['compact'])-mb_strlen($y['compact']))>$limit)return null;
    return $length>=6&&($distance=catalog_distance($x['compact'],$y['compact']))<=$limit&&$distance/$length<=0.15?'similar':null;
}
function catalog_existing_match(array $row,array $existing): ?array
{
    foreach($existing as $candidate){$match=catalog_match($row,$candidate);if($match!==null)return ['kind'=>$match,'item'=>$candidate];}return null;
}
/** Reuse the existing type and brand spelling, including when importing a new model. */
function catalog_existing_spelling(array $row,array $existing): array
{
    foreach($existing as $candidate)if(catalog_type($row['type'])===catalog_type($candidate['type'])){
        $row['type']=$candidate['type'];
        if(catalog_brand($row['brand'])===catalog_brand($candidate['brand'])){$row['brand']=$candidate['brand'];break;}
    }
    return $row;
}
