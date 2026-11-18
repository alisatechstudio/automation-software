# Google Cloud & YouTube Data API v3 Setup Guide

This guide walks you through generating persistent, production-grade OAuth2 credentials for **SportsClipBot** to upload YouTube Shorts with resumable streaming, automatic copyright checks, and synthetic media disclosures.

---

## 1. Create a Project in Google Cloud Console

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project**.
3. Name your project (e.g., `SportsClipBot-Automation`) and click **Create**.

---

## 2. Enable the YouTube Data API v3

1. In the left navigation menu, go to **APIs & Services** > **Library**.
2. Search for `YouTube Data API v3`.
3. Click on the card and select **Enable**.

---

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace). Click **Create**.
3. Fill in the required app details:
   - **App name**: `SportsClipBot`
   - **User support email**: Your email address
   - **Developer contact email**: Your email address
4. Click **Save and Continue**.
5. In the **Scopes** step, click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/youtube.upload` (Upload YouTube videos)
   - `https://www.googleapis.com/auth/youtube` (Manage YouTube account & check video status)
   - `https://www.googleapis.com/auth/youtube.readonly` (View YouTube account reports & claims)
6. In the **Test users** step, add the Gmail address associated with the YouTube channel where the videos will be published.
7. Click **Save and Continue**.

---

## 4. Create OAuth2 Client ID Credentials

1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Web application** (or **Desktop app**).
4. Name: `SportsClipBot Client`.
5. Under **Authorized redirect URIs**, add:
   - `https://developers.google.com/oauthplayground` (useful for initial token generation)
   - `http://localhost:3000/oauth2callback`
6. Click **Create**.
7. Copy your **Client ID** and **Client Secret**.

---

## 5. Generate a Long-Lived Refresh Token

Using the [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground):

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Click the gear icon (⚙️) in the top right corner:
   - Check **Use your own OAuth credentials**.
   - Enter your **OAuth Client ID** and **OAuth Client Secret**.
3. In Step 1 (Select & authorize APIs), scroll down to **YouTube Data API v3** and select:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
4. Click **Authorize APIs** and log in with your YouTube channel owner account.
5. In Step 2 (Exchange authorization code for tokens):
   - Click **Exchange authorization code for tokens**.
6. Copy the resulting **Refresh token** (starts with `1//...`).

---

## 6. Update Your `.env` File

Add the generated values to your `.env` file:

```env
YOUTUBE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-your-google-client-secret
YOUTUBE_REFRESH_TOKEN=1//04your-long-lived-oauth2-refresh-token
```

---

## 7. Crucial YouTube Partner Program & Quota Notes

### API Quota Allocation
- Default free quota: **10,000 units per day**.
- A `videos.insert` call consumes **1,600 units**.
- A `thumbnails.set` call consumes **50 units**.
- This allows **~6 uploads per day** on the default quota.
- `SportsClipBot` enforces a configurable daily volume cap (`dailyCapPerPlatform: 3`, default 2–3) to protect your quota from exhaustion and avoid algorithmic spam signals.

### Altered or Synthetic Content Policy
- YouTube's 2024+ Creator Policy mandates disclosure if video content includes synthetic or altered elements (such as AI commentary, digital voiceovers, or generated visuals).
- `SportsClipBot` automatically applies `status.containsSyntheticMedia: true` on every upload and includes standard disclosure text in the description to ensure full monetization compliance.
