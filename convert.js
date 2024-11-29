import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import { promisify } from 'util';
import multer from 'multer';

const unlinkAsync = promisify(fs.unlink);

// Configure FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Multer setup for file handling (storing files in /tmp/)
const upload = multer({ dest: '/tmp/' });

export const config = {
  api: {
    bodyParser: false, // Required for file uploads to work with Multer
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // Use a promise wrapper for Multer to handle file upload
      const file = await new Promise((resolve, reject) => {
        upload.single('file')(req, {}, (err) => {
          if (err) reject(err);
          else resolve(req.file);
        });
      });

      // Ensure the file exists
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const inputPath = file.path;
      const outputPath = `/tmp/${file.filename}.mp3`;

      // Convert MP4 to MP3
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      // Read the converted MP3 file
      const mp3Buffer = await fs.promises.readFile(outputPath);

      // Clean up temporary files
      await unlinkAsync(inputPath);
      await unlinkAsync(outputPath);

      // Respond with the MP3 file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="output.mp3"');
      res.send(mp3Buffer);
    } catch (error) {
      console.error('Error during conversion:', error);
      res.status(500).json({ error: 'Conversion failed. Please try again.' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed. Use POST instead.' });
  }
}
