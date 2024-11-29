import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import axios from 'axios';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);

// Configure FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  api: {
    bodyParser: true, // Enable body parsing to accept JSON
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ error: 'File URL is required' });
      }

      // Temporary paths for input and output files
      const inputPath = `/tmp/input.mp4`;
      const outputPath = `/tmp/output.mp3`;

      // Download the file from Google Cloud Storage
      const response = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'stream',
      });

      const writer = fs.createWriteStream(inputPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Convert MP4 to MP3 using FFmpeg
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
      console.error('Error during processing:', error);
      res.status(500).json({ error: 'Processing failed. Please try again.' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
