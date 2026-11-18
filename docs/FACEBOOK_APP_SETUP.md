# Facebook Developer App & Meta Graph API Setup Guide

This guide details how to configure a Meta for Developers application, acquire a **never-expiring Page Access Token**, and navigate **App Review & Content Monetization Policies** for publishing Facebook Reels with **SportsClipBot**.

---

## 1. Create a Meta for Developers App

1. Go to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Log in with your Facebook account and select **My Apps** > **Create App**.
3. Select **Other** as the use case, then choose **Business** as the app type.
4. Name your application (e.g., `SportsClipBot-Reels`) and enter your contact email.
5. Link your **Meta Business Account** and click **Create App**.

---

## 2. Required Permissions

To upload Reels and manage Page posts, your app requires the following permissions:

| Permission | Purpose | App Review Needed? |
| :--- | :--- | :--- |
| `pages_show_list` | Access list of Pages you manage | No (for admins/testers) |
| `pages_read_engagement` | Read Page stats and comments | No (for admins/testers) |
| `pages_manage_posts` | Publish posts and videos to Page | Yes (for live public apps) |
| `publish_video` | Stream video assets and publish Reels | Yes (for live public apps) |

> [!NOTE]
> If you are the admin of both the Facebook Page and the Meta Developer App, you can operate indefinitely in **Development Mode** without submitting for formal App Review!

---

## 3. Generate a Never-Expiring Page Access Token

Follow these steps using the [Graph API Explorer](https://developers.facebook.com/tools/explorer/):

### Step A: Generate Short-Lived User Access Token
1. Select your app in the **Meta App** dropdown.
2. Under **User or Page**, select **User Token**.
3. Under **Permissions**, add:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `publish_video`
4. Click **Generate Access Token** and approve the authorization dialog.

### Step B: Exchange for a Long-Lived (60-day) User Token
Make an HTTP GET request (via curl or browser):
```text
https://graph.facebook.com/v21.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={YOUR_APP_ID}&
  client_secret={YOUR_APP_SECRET}&
  fb_exchange_token={SHORT_LIVED_USER_TOKEN}
```
This returns `{ "access_token": "{LONG_LIVED_USER_TOKEN}", "expires_in": 5184000 }`.

### Step C: Retrieve the Never-Expiring Page Access Token
Using the `{LONG_LIVED_USER_TOKEN}`, request your Page's token:
```text
https://graph.facebook.com/v21.0/{YOUR_PAGE_ID}?fields=access_token&access_token={LONG_LIVED_USER_TOKEN}
```
The returned `access_token` for your Page **never expires** unless you reset your password or revoke app permissions.

---

## 4. Find Your Facebook Page ID

1. Open your Facebook Page in a browser.
2. Click **About** > **Page Transparency** (or go to Page Settings > General).
3. Copy your numeric **Page ID** (e.g., `109283746591823`).

---

## 5. Update Your `.env` File

Add the credentials to `.env`:
```env
FACEBOOK_PAGE_ID=109283746591823
FACEBOOK_PAGE_ACCESS_TOKEN=EAAG...your-never-expiring-page-token...
```

---

## 6. Official 3-Phase Reels Publishing Flow

`SportsClipBot` uses Meta's official 3-phase Reels upload session:

1. **Phase 1 (Start session)**:
   - `POST https://graph.facebook.com/v21.0/{page_id}/video_reels`
   - Payload: `{ upload_phase: "start", access_token }`
   - Returns: `{ video_id, upload_url }`
2. **Phase 2 (Transfer binary)**:
   - `POST {upload_url}`
   - Headers: `Authorization: OAuth {token}`, `offset: 0`, `file_size: {size}`, `Content-Type: application/octet-stream`
   - Body: Raw MP4 video binary
3. **Phase 3 (Finish & publish)**:
   - `POST https://graph.facebook.com/v21.0/{page_id}/video_reels`
   - Payload: `{ upload_phase: "finish", video_id, video_state: "PUBLISHED", description, access_token }`
4. **Phase 4 (Status polling)**:
   - `GET https://graph.facebook.com/v21.0/{video_id}?fields=status&access_token`
   - Verified ready prior to logging success.

---

## 7. Meta Content Monetization Policy Notes

### Limited Originality of Content (LOC) Flag
Meta enforces automated detection for unoriginal video feeds. Accounts that simply repost third-party clips without transformative additions receive an **LOC strike**, which revokes monetization.

To prevent LOC penalties:
- **Transformative Editing**: `SportsClipBot` guarantees that original graphics, voiceover breakdowns, and lower-third credits are permanently rendered into the video canvas.
- **Ratio Rule**: Licensed clips are kept under 60% of total video runtime; at least 40% represents original analysis.
- **Deduplication**: Uniqueness hashing ensures no repeat clips or near-identical reels are published.
