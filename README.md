# GWSC 表白墙 V4 前端

这是基于 V3.1 安全版 SQL 的前端升级包。

## V4 新增
- 真正可打开的五子棋棋盘
- 简化 Chess 棋盘
- 私聊里邀请好友玩五子棋 / Chess
- 游戏记录写入 Supabase：
  - game_sessions
  - game_moves
- 游戏弹窗
- 游戏列表
- 五子棋胜负判断
- Chess 回合制移动（简化版，不含完整将军/将死规则）

## 使用方法
1. 先在 Supabase 运行 `gwsc_v3_1_secure_rebuild.sql`
2. 把这个 V4 项目上传到原 GitHub 仓库，覆盖旧代码
3. Vercel 自动重新部署
4. 确认环境变量仍然存在：
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY

## 重要
如果你之前的前端还在直接 insert posts/comments/messages，V4 已经改成优先使用 V3.1 的 RPC：
- create_post
- create_comment
- toggle_like
- share_post
- add_friend_by_numeric_id
- send_private_message
- create_group_chat
- invite_game
- create_game_move

Chess 是简化版，只能移动棋子和轮流走，不含完整国际象棋规则。


## V4 额外 SQL Patch

请在 Supabase SQL Editor 里运行：

```text
supabase/v4_patch.sql
```

这个 patch 会：
- 收紧 owner/admin posts view
- 确保游戏表 realtime 可用

顺序：
1. 运行 V3.1 安全版 SQL
2. 运行 `supabase/v4_patch.sql`
3. 部署 V4 前端
