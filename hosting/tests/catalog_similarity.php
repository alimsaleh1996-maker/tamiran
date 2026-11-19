<?php
declare(strict_types=1);
require dirname(__DIR__).'/private/catalog-similarity.php';
$vectors=json_decode(file_get_contents(__DIR__.'/fixtures/catalog-similarity.json'),true,512,JSON_THROW_ON_ERROR);
foreach($vectors as $i=>$v){foreach([[$v['a'],$v['b']],[$v['b'],$v['a']]] as [$a,$b]){if(catalog_match($a,$b)!==$v['expected'])throw new RuntimeException('Catalog parity failed at vector '.($i+1));}}
echo 'PASS '.count($vectors).' similarity vectors in PHP'.PHP_EOL;
