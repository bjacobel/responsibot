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
  let decryptedSecrets = Promise.resolve({
    SAUCE_USERNAME: process.env.SAUCE_USERNAME,
    SAUCE_ACCESS_KEY: process.env.SAUCE_ACCESS_KEY,
  });

  const kms = new AWS.KMS();

  if (!process.env.LOCAL) {
    decryptedSecrets = kms.decrypt({
      CiphertextBlob: new Buffer(decryptedSecrets.SAUCE_USERNAME, 'base64'),
    }, (err, data) => data.Plaintext.toString('ascii'))
      .promise()
      .then(username => kms.decrypt({
        CiphertextBlob: new Buffer(decryptedSecrets.SAUCE_ACCESS_KEY, 'base64'),
      }, (err, data) => ({
        SAUCE_USERNAME: username,
        SAUCE_ACCESS_KEY: data.Plaintext.toString('ascii'),
      })))
      .promise();
  }

  return decryptedSecrets.then(({ SAUCE_USERNAME, SAUCE_ACCESS_KEY }) => {
    const wdconf = {
      host: 'ondemand.saucelabs.com',
      port: 80,
      user: SAUCE_USERNAME,
      key: SAUCE_ACCESS_KEY,
      logLevel: 'verbose',
    };

    const browser = {
      browserName: 'Browser',
      platformVersion: '4.4',
      platformName: 'Android',
      deviceName: 'Samsung Galaxy Nexus Emulator',
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
  });
};

module.exports = {
  handler: (event, context, callback) => responsibot(event.url)
    .then((screenshot) => {
      callback(null, screenshot);
    })
    .catch(err => callback(err)),
};
