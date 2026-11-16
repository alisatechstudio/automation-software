<?php
// Emergency CloudLinux Process & Lock Reset Tool for cPanel / Hostseba
ini_set('display_errors', '1');
error_reporting(E_ALL);

header('Content-Type: text/plain; charset=utf-8');
while (ob_get_level()) ob_end_flush();
ob_implicit_flush(1);

echo "========================================================\n";
echo "HOSTSEBA / CLOUDLINUX EMERGENCY PROCESS & LOCK RESET\n";
echo "========================================================\n\n";

$user = get_current_user();
$home = getenv('HOME') ?: "/home/$user";
echo "Current system user: " . htmlspecialchars($user) . "\n";
echo "Home directory: " . htmlspecialchars($home) . "\n\n";

// -----------------------------------------------------------------------------
// STEP 1: PURE PHP LOCK FILE SCANNER & CLEANER (Works even if exec is disabled)
// -----------------------------------------------------------------------------
echo "[1/3] Scanning for CloudLinux and Node.js lock files...\n";

$searchPaths = [
    "$home/.cl.selector",
    "$home/nodevenv",
    "$home/automation",
    "$home/public_html",
    "$home/tmp",
    "/tmp",
];

$deletedLocks = 0;
foreach ($searchPaths as $dir) {
    if (!is_dir($dir)) continue;
    echo "  > Checking directory: $dir\n";

    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $fileInfo) {
            $filename = $fileInfo->getFilename();
            $path = $fileInfo->getPathname();

            // Match .lock, *.lock, or app.lock (exclude package-lock.json)
            if (
                $filename !== 'package-lock.json' &&
                ($filename === '.lock' || substr($filename, -5) === '.lock' || substr($filename, -9) === '-lock.pid')
            ) {
                // Ensure it's a lock file and owned by or writable by user
                if ($fileInfo->isFile() && is_writable($path)) {
                    if (@unlink($path)) {
                        echo "    [DELETED] Lock file: $path\n";
                        $deletedLocks++;
                    } else {
                        echo "    [FAILED TO DELETE] Lock file: $path (Permission denied)\n";
                    }
                }
            }
        }
    } catch (Throwable $e) {
        echo "    Notice in $dir: " . $e->getMessage() . "\n";
    }
}

if ($deletedLocks === 0) {
    echo "  > No lock files found on disk. Lock is held by an in-memory process.\n";
} else {
    echo "  > Successfully deleted $deletedLocks lock file(s)!\n";
}
echo "\n";

// -----------------------------------------------------------------------------
// STEP 2: PROCESS TERMINATION (With safe Throwable exception handling)
// -----------------------------------------------------------------------------
echo "[2/3] Checking available process termination execution methods...\n";

$disabledFunctions = explode(',', (string)ini_get('disable_functions'));
$disabledFunctions = array_map('trim', $disabledFunctions);

$canExec = function_exists('exec') && !in_array('exec', $disabledFunctions);
$canShellExec = function_exists('shell_exec') && !in_array('shell_exec', $disabledFunctions);
$canSystem = function_exists('system') && !in_array('system', $disabledFunctions);
$canPassthru = function_exists('passthru') && !in_array('passthru', $disabledFunctions);

echo "  > Function status: exec=" . ($canExec ? 'ENABLED' : 'DISABLED') . 
     ", shell_exec=" . ($canShellExec ? 'ENABLED' : 'DISABLED') . 
     ", system=" . ($canSystem ? 'ENABLED' : 'DISABLED') . "\n";

$commands = [
    "pkill -9 -u " . escapeshellarg($user) . " -f node",
    "pkill -9 -u " . escapeshellarg($user) . " -f npm",
    "pkill -9 -u " . escapeshellarg($user) . " -f ffmpeg",
    "killall -9 -u " . escapeshellarg($user) . " node",
    "killall -9 -u " . escapeshellarg($user) . " npm",
    "cloudlinux-selector stop --interpreter nodejs --user " . escapeshellarg($user) . " --app-root " . escapeshellarg("$home/automation"),
];

$executed = false;
if ($canExec || $canShellExec || $canSystem || $canPassthru) {
    echo "  > Terminating stuck node, npm, and selector processes...\n";
    foreach ($commands as $cmd) {
        $out = [];
        $ret = 0;
        try {
            if ($canExec) {
                @exec("$cmd 2>&1", $out, $ret);
            } elseif ($canShellExec) {
                $raw = @shell_exec("$cmd 2>&1");
                if ($raw) $out = explode("\n", trim($raw));
            } elseif ($canSystem) {
                ob_start();
                @system("$cmd 2>&1", $ret);
                $raw = ob_get_clean();
                if ($raw) $out = explode("\n", trim($raw));
            }
            echo "    > $cmd (Code: $ret)\n";
            if (!empty($out)) {
                echo "      " . implode("\n      ", array_filter($out)) . "\n";
            }
            $executed = true;
        } catch (Throwable $t) {
            echo "    > $cmd failed: " . $t->getMessage() . "\n";
        }
    }
} else {
    echo "  > NOTICE: Shell execution is disabled in PHP by your hosting policy.\n";
    echo "    To kill processes manually, use cPanel -> Terminal and run:\n";
    echo "    pkill -9 -u $user -f node\n";
}
echo "\n";

// -----------------------------------------------------------------------------
// STEP 3: PASSENGER RESTART TRIGGER
// -----------------------------------------------------------------------------
echo "[3/3] Triggering Passenger restart flag...\n";
$restartFile = "$home/automation/tmp/restart.txt";
if (file_exists(dirname($restartFile))) {
    @file_put_contents($restartFile, date('c') . ": Reset triggered via reset-server.php\n");
    echo "  > Updated: $restartFile\n";
}

echo "========================================================\n";
echo "CLEANUP COMPLETE!\n";
echo "1. Go back to cPanel -> 'Setup Node.js App'.\n";
echo "2. Refresh your browser page (Ctrl + F5).\n";
echo "3. You can now Start, Restart, or Edit your app without lock errors.\n";
echo "========================================================\n";
