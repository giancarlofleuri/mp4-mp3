import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import { promisify } from 'util';
import multer from 'multer';

const unlinkAsync = promisify(fs.unlink);

// Configure FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Multer setup for file handling
const upload = multer({ dest: '/tmp/' });

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // Handle file upload
      await new Promise((resolve, reject) => {
        upload.single('file')(req, {}, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const inputPath = req.file.path;
      const outputPath = `/tmp/${req.file.filename}.mp3`;

      // Convert MP4 to MP3
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      // Read converted file
      const mp3Buffer = await fs.promises.readFile(outputPath);

      // Clean up temporary files
      await unlinkAsync(inputPath);
      await unlinkAsync(outputPath);

      // Respond with MP3 file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="output.mp3"');
      res.send(mp3Buffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Conversion failed' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
