<?php
require __DIR__ . '/vendor/autoload.php';

use Slim\Factory\AppFactory;
use Kreait\Firebase\Factory;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

$app = AppFactory::create();

$factory = (new Factory)
    ->withServiceAccount(__DIR__ . '/' . $_ENV['FIREBASE_CREDENTIALS'])
    ->withDatabaseUri('https://zaman-sinirlamali-kilit-default-rtdb.europe-west1.firebasedatabase.app');
$database = $factory->createDatabase();

$app->get('/api/sistem-durumu', function ($request, $response, $args) use ($database) {
    $reference = $database->getReference('sistem_durumu');
    $value = $reference->getValue();

    $response->getBody()->write(json_encode($value));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->run();
