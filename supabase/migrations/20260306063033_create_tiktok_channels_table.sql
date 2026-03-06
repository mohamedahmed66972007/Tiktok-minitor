/*
  # إنشاء جدول قنوات TikTok

  1. جداول جديدة
    - `tiktok_channels`
      - `id` (uuid, primary key) - معرف فريد
      - `tiktok_username` (text, unique) - يوزرنيم قناة TikTok
      - `discord_channel_id` (text) - معرف قناة Discord
      - `video_message` (text) - رسالة الفيديو الجديد
      - `live_message` (text) - رسالة البث المباشر
      - `last_video_id` (text) - آخر فيديو تم نشره
      - `is_live` (boolean) - حالة البث المباشر
      - `created_at` (timestamptz) - تاريخ الإضافة

  2. الأمان
    - تفعيل RLS على الجدول
    - إضافة سياسات للقراءة والكتابة
*/

CREATE TABLE IF NOT EXISTS tiktok_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_username text UNIQUE NOT NULL,
  discord_channel_id text NOT NULL,
  video_message text NOT NULL,
  live_message text NOT NULL,
  last_video_id text DEFAULT '',
  is_live boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tiktok_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON tiktok_channels
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access"
  ON tiktok_channels
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON tiktok_channels
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access"
  ON tiktok_channels
  FOR DELETE
  TO public
  USING (true);