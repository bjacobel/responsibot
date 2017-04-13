const webdriverio = require('webdriverio');
const AWS = require('aws-sdk');

const s3put = (b64) => {
  const filename = `${Date.now()}.png`;

  return new AWS.S3.ManagedUpload({
    params: {
      Bucket: 'responsibot',
      Key: filename,
      Body: Buffer.from(b64.value, 'base64'),
      ContentType: 'image/png',
      ACL: 'public-read',
    },
  })
  .promise()
  .then(() => `https://responsibot.s3.amazonaws.com/${filename}`);
};

const responsibot = (url) => {
  const wdconf = {
    host: 'ondemand.saucelabs.com',
    port: 80,
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,
    logLevel: 'verbose',
  };

  const browser = {
    browserName: 'safari',
    platformVersion: '10.2',
    platformName: 'iOS',
    deviceName: 'iPhone 7 Plus Simulator',
  };

  Object.assign(wdconf, {
    desiredCapabilities: browser,
  });

  // navigate to url
  const client = webdriverio.remote(wdconf);

  return new Promise(resolve => client
    .init()
    .url(url)
    .screenshot()
    .then(base64 => resolve(s3put(base64)))
    .end()  // eslint-disable-line comma-dangle
  );
};

module.exports = {
  handler: (event, context, callback) => responsibot('https://courses.edx.org'),
};

// TEST CODE

responsibot('https://courses.edx.org').then((screenshotUrl) => {
  return console.log(screenshotUrl);
});
