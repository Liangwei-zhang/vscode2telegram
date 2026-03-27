# TODO - vscode2telegram

## ✅ 完成 (v2.0)

### 核心功能
- [x] Telegram Bot 完整指令集
- [x] WebSocket bridge server
- [x] VSCode Extension 完整功能
- [x] Session 管理（含 TTL 清理）
- [x] LM API 集成 (vscode.lm)
- [x] Markdown → MarkdownV2 轉換
- [x] 代碼塊截斷與分頁

### 安全
- [x] 用戶白名單
- [x] 危險命令黑名單
- [x] 頻率限制
- [x] 命令超時處理
- [x] 啟動配置驗證
- [x] Pending request 清理

### 生產級別
- [x] 配置管理 (ConfigManager)
- [x] 日誌系統 (logger)
- [x] 錯誤處理 (errors)
- [x] 健康檢查 (health-check)
- [x] 指標準集 (metrics)

### DevOps
- [x] 完整 .gitignore
- [x] MIT LICENSE
- [x] package.json 完整元數據
- [x] .prettierrc
- [x] 完整 .env.example

### 測試
- [x] 90 個測試全部通過
- [x] 商業級別 QA

## 🔜 未來規劃

### Phase 3: 安全性與穩定性
- [ ] WebSocket 連接添加 token 認證
- [ ] file-manager 添加路徑遍歷防護
- [ ] terminal-runner 改用 execFile + 參數分離
- [ ] 命令黑名單改為更健壯的策略

### Phase 4: CI/CD
- [ ] GitHub Actions workflow
- [ ] ESLint + Prettier 配置
- [ ] pre-commit hooks (husky)

### Phase 5: 文檔
- [ ] CONTRIBUTING.md
- [ ] 發布 .vsix 指引

---

**狀態：v2.0 生產就緒** ✅