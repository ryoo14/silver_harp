# Silver Harp

This application converts articles saved in Instapaper into audio files, enabling you to listen to them as podcasts. It creates and updates an RSS feed with these audio files, each augmented with chapters for easy navigation.

## Features

- **Article-to-Audio Conversion**: Converts Instapaper articles into individual audio files.
- **Chapter Support**: Adds chapters to each audio file for convenient navigation.
- **RSS Feed Creation**: Generates and updates an RSS feed with the converted audio files, making it suitable for podcast platforms.
- **Google Cloud API for TTS**: Utilizes Google Cloud Text-to-Speech API for high-quality audio conversion.
- **Typescript and Bash Scripts**: Uses TypeScript to convert articles into audio files and Bash scripts for audio file concatenation, chapter writing, and RSS feed updates.
- **Automation Ready**: The entire process can be automated by uploading the audio files and RSS feed to a hosting service using GitHub Actions or similar CI/CD tools.

## Important Notes

- **Instapaper API Usage**: Be aware that the Instapaper API is used to delete articles after conversion. This is not archiving; the articles will not remain in your Instapaper account after they are processed.

## Getting Started

To get started with this application, ensure you have all the necessary environment variables configured. This setup is crucial for the application to access your Instapaper account and for configuring the server where the RSS feed and audio files will be hosted.

 - `INSTAPAPER_USER_NAME`
 - `INSTAPAPER_USER_PASSWORD`
 - `INSTAPAPER_CONSUMER_KEY`
 - `INSTAPAPER_CONSUMER_SECRET`
 - `SILVERHARP_SERVER`
 - `SILVERHARP_USER`

## Automation with CI/CD

To fully automate the process, consider using GitHub Actions or a similar CI/CD tool to automatically upload the generated audio files and RSS feed to your hosting server. This step makes the podcast content accessible to your audience without manual intervention.

## Contributing

Contributions to the project are welcome. If you have suggestions for improvements or encounter any issues, please feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
