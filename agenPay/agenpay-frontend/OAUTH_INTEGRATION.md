# Notion OAuth Integration Guide

## 🔐 OAuth Flow Implementation

### Backend Configuration

The backend now supports Notion OAuth flow with these new endpoints:

1. **GET `/api/notion/auth-url`** - Generates OAuth authorization URL
2. **POST `/api/notion/callback`** - Handles OAuth callback with code extraction

### Frontend OAuth Flow

The frontend implements a complete OAuth flow:

1. **Login/Register** → User authenticates
2. **Notion Step** → Click "Connect with Notion" 
3. **OAuth Redirect** → User authorizes on Notion
4. **Callback Handler** → Extracts code and exchanges for token
5. **Workspace Setup** → Automatically creates payment databases
6. **Wallet Setup** → Optional wallet creation

### Key Files

#### Frontend:
- `lib/auth.ts` - OAuth methods: `getNotionAuthUrl()`, `connectNotionWithCode()`
- `app/auth/login/page.tsx` - Updated to use OAuth instead of API key
- `app/auth/notion-callback/page.tsx` - Handles OAuth callback
- `middleware.ts` - Allows callback route without authentication

#### Backend:
- `server.js` - Added OAuth endpoints
- `env` - Added Notion OAuth credentials and frontend URL

### OAuth Security Features

- **State Parameter**: Uses user ID for CSRF protection
- **Secure Token Exchange**: Direct server-to-server communication
- **Encrypted Storage**: Access tokens encrypted in database
- **Automatic Workspace Setup**: Creates databases after successful auth

### Environment Variables

```bash
# Backend (.env)
NOTION_CLIENT_ID=1e0d872b-594c-80f5-80f8-0037eed24479
NOTION_CLIENT_SECRET=secret_xbn2X10Wo7tjYJnmVeu5yX9LCnpEQcGxL312KqDrijy
FRONTEND_URL=http://localhost:3000

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Testing the OAuth Flow

1. Start backend: `cd agenpay-backend && npm run dev`
2. Start frontend: `cd agenpay-frontend && npm run dev`
3. Navigate to: http://localhost:3000
4. Register/Login → Click "Connect with Notion"
5. Authorize on Notion → Redirected back with success

### OAuth URL Structure

```
https://api.notion.com/v1/oauth/authorize?
  client_id=1e0d872b-594c-80f5-80f8-0037eed24479&
  response_type=code&
  owner=user&
  redirect_uri=http://localhost:3000/auth/notion-callback&
  state=USER_ID
```

### Callback Processing

1. Extract `code` and `state` from URL parameters
2. Verify `state` matches authenticated user ID
3. Exchange code for access token via Notion API
4. Setup workspace databases automatically
5. Store encrypted access token in database
6. Redirect to wallet setup or dashboard

## 🎯 Ready to Use!

The OAuth integration provides a seamless, secure way for users to connect their Notion workspaces without manually handling API keys. 