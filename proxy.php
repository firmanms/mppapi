<?php
// Izinkan akses CORS dari mana saja
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Jika ini preflight request (OPTIONS), langsung kembalikan OK
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Ambil parameter url dari query string
$url = isset($_GET['url']) ? $_GET['url'] : '';

if (empty($url)) {
    echo json_encode(["status" => "error", "message" => "URL parameter is required."]);
    exit;
}

// Gunakan cURL untuk mengambil data dari server asli
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
// Hindari error SSL (opsional, karena mpp.bandungkab.com pakai HTTPS)
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

// Tambahkan user-agent agar tidak diblokir oleh sistem keamanan tertentu
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if(curl_errno($ch)){
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => curl_error($ch)]);
} else {
    http_response_code($httpcode);
    echo $response;
}

curl_close($ch);
?>
