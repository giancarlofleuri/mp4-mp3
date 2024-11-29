import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import multiparty from 'multiparty';
import fs from 'fs';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);

// Configure FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  api: {
    bodyParser: false, // Disable Vercel's body parser for streaming
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const form = new multiparty.Form({ uploadDir: '/tmp/' });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form:', err);
        return res.status(400).json({ error: 'File upload error' });
      }

      try {
        // Get the uploaded file path
        const file = files.file[0];
        const inputPath = file.path;
        const outputPath = `/tmp/${file.originalFilename}.mp3`;

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
    });
  } else {
    res.status(405).json({ error: 'Method not allowed. Use POST instead.' });
  }
}
