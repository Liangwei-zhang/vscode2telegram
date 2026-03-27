# vscode2telegram TODO

## 開發進度

### Phase 1: 基礎通信 ✅
- [x] Bridge WebSocket Server (port 3456)
- [x] Telegram Bot 初始化
- [x] 指令處理：/start, /status
- [x] Session Manager
- [x] Auth Middleware (用戶白名單)
- [x] VSCode Extension 框架
- [x] WS Client

### Phase 2: 終端集成 ✅
- [x] terminal-runner.ts
- [x] /terminal 命令
- [x] 命令輸出返回

### Phase 3: Agent Chat 集成 ⏳
- [ ] lm-handler.ts (vscode.lm API)
- [ ] 流式響應
- [ ] /chat 命令優化

### Phase 4: 文件操作 ✅
- [x] file-manager.ts
- [x] /file, /ls 命令
- [x] /edit 命令框架

### Phase 5: 完善與優化 ⏳
- [x] 命令超時處理
- [x] 危險命令黑名單
- [ ] rate-limit 中間件
- [ ] Extension 打包 .vsix

## QA 測試 ✅
- [x] 單元測試 (16 tests)
- [x] 商業級別 QA (51 tests)
- [x] 集成測試
- [x] 性能測試

## 待完成
1. Phase 3: vscode.lm API 集成
2. Extension 打包發布
3. Rate-limit 中間件
4. 流式響應優化