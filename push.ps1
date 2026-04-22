# GitHub自動記録・プッシュスクリプト
# 実行方法: ターミナルで .\push.ps1 と入力してEnter

Write-Host "変更をGitHubにプッシュしています..." -ForegroundColor Cyan

# 変更をすべてステージング
git add -A

# 変更があるか確認
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "変更はありません。プッシュをスキップします。" -ForegroundColor Yellow
    exit
}

# 日時を取得してコミットメッセージを作成
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMsg = "Auto backup: $timestamp"

# コミットとプッシュ
git commit -m $commitMsg
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHubへのプッシュが完了しました！ ($timestamp)" -ForegroundColor Green
} else {
    Write-Host "❌ プッシュに失敗しました。" -ForegroundColor Red
}
