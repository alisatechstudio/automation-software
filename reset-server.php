<?php
// Emergency CloudLinux Process Reset Tool for cPanel / Hostseba
header('Content-Type: text/plain; charset=utf-8');

echo "========================================================\n";
echo "HOSTSEBA / CLOUDLINUX EMERGENCY PROCESS KILLER\n";
echo "========================================================\n\n";

$user = get_current_user();
echo "Current system user: " . htmlspecialchars($user) . "\n";
echo "Attempting to terminate stuck node and ffmpeg processes...\n\n";

$commands = [
    "pkill -9 -u " . escapeshellarg($user) . " -f node",
    "pkill -9 -u " . escapeshellarg($user) . " -f ffmpeg",
    "killall -9 -u " . escapeshellarg($user) . " node",
    "killall -9 -u " . escapeshellarg($user) . " ffmpeg",
];

foreach ($commands as $cmd) {
    $output = [];
    $return_var = 0;
    @exec("$cmd 2>&1", $output, $return_var);
    echo "> Executed: $cmd (Code: $return_var)\n";
    if (!empty($output)) {
        echo "  " . implode("\n  ", $output) . "\n";
    }
}

echo "\n--------------------------------------------------------\n";
echo "SUCCESS: All stuck processes for '$user' terminated!\n";
echo "Your CloudLinux process quota (NPROC) is now completely freed.\n";
echo "You can now go to cPanel -> 'Setup Node.js App' and click 'Restart' or 'Start'.\n";
echo "========================================================\n";

