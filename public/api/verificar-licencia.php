<?php
// Verificación de licencia de CalificaYa (Hostinger). Mismo contrato que
// netlify/functions/verificar-licencia.mjs: recibe por POST product_id,
// license_key e increment_uses_count, los reenvía a Gumroad y devuelve su
// respuesta y su código tal cual. No guarda ni registra la licencia.
// Límite: 30 intentos por IP cada 10 minutos, contados en la carpeta temporal
// del sistema (nunca dentro de public_html).

declare(strict_types=1);

const CY_GUMROAD = 'https://api.gumroad.com/v2/licenses/verify';
const CY_PERMITIDOS = ['product_id', 'license_key', 'increment_uses_count'];
const CY_MAX_CARACTERES = 200;
const CY_MAX_CUERPO = 4096;
const CY_LIMITE_INTENTOS = 30;
const CY_VENTANA_SEGUNDOS = 600;

/** Deja pasar solo los campos permitidos, como texto y recortados a 200 caracteres. */
function cy_filtrar(string $cuerpo): array
{
    parse_str($cuerpo, $entrada);
    $salida = [];
    foreach (CY_PERMITIDOS as $campo) {
        if (!isset($entrada[$campo]) || !is_string($entrada[$campo])) continue;
        $valor = $entrada[$campo];
        $salida[$campo] = function_exists('mb_substr')
            ? mb_substr($valor, 0, CY_MAX_CARACTERES, 'UTF-8')
            : substr($valor, 0, CY_MAX_CARACTERES);
    }
    return $salida;
}

/** true si la IP todavía tiene intentos en la ventana actual (y cuenta este). */
function cy_permitir_intento(string $ip, int $ahora): bool
{
    $dir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'calificaya-limite';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return true;
    $archivo = $dir . DIRECTORY_SEPARATOR . hash('sha256', $ip);
    $h = @fopen($archivo, 'c+');
    if ($h === false) return true; // si no se puede contar, no se bloquea a nadie
    try {
        flock($h, LOCK_EX);
        $previos = json_decode((string) stream_get_contents($h), true);
        $intentos = array_values(array_filter(
            is_array($previos) ? $previos : [],
            static fn ($t) => is_int($t) && $t > $ahora - CY_VENTANA_SEGUNDOS
        ));
        $permitido = count($intentos) < CY_LIMITE_INTENTOS;
        if ($permitido) $intentos[] = $ahora;
        ftruncate($h, 0);
        rewind($h);
        fwrite($h, json_encode($intentos));
        return $permitido;
    } finally {
        flock($h, LOCK_UN);
        fclose($h);
    }
}

function cy_responder(int $codigo, string $json, array $extra = []): void
{
    http_response_code($codigo);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    foreach ($extra as $linea) header($linea);
    echo $json;
}

function cy_atender(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        cy_responder(405, '{"success":false,"error":"metodo-no-permitido"}', ['Allow: POST']);
        return;
    }
    if (!cy_permitir_intento((string) ($_SERVER['REMOTE_ADDR'] ?? 'desconocida'), time())) {
        cy_responder(429, '{"success":false,"error":"demasiados-intentos"}', ['Retry-After: ' . CY_VENTANA_SEGUNDOS]);
        return;
    }
    $cuerpo = (string) file_get_contents('php://input', false, null, 0, CY_MAX_CUERPO);
    $fallo = '{"success":false,"error":"gumroad-no-disponible"}';
    if (!function_exists('curl_init')) {
        cy_responder(502, $fallo);
        return;
    }
    $c = curl_init(CY_GUMROAD);
    curl_setopt_array($c, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(cy_filtrar($cuerpo)),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
    ]);
    $respuesta = curl_exec($c);
    $codigo = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    curl_close($c);
    if (!is_string($respuesta) || $codigo === 0) {
        cy_responder(502, $fallo);
        return;
    }
    cy_responder($codigo, $respuesta);
}

// Desde la línea de comandos (pruebas) solo se cargan las funciones.
if (PHP_SAPI !== 'cli') {
    ini_set('display_errors', '0');
    ini_set('log_errors', '0');
    cy_atender();
}
