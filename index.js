const webdriverio = require('webdriverio');
const AWS = require('aws-sdk');
const request = require('request-promise');

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

const decryptSecret = (name) => {
  const kms = new AWS.KMS();

  return new Promise((resolve, reject) => {
    kms.decrypt({
      CiphertextBlob: new Buffer(name, 'base64'),
    }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Plaintext.toString('ascii'));
      }
    });
  });
};

// returns a url
const parseBody = body => body.match(/responsibot.*(https?:\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/)[1];

const postToGitHub = (screenshotUrl, issueUrl, pullId, commentId) => {
  let githubToken = Promise.resolve(process.env.GITHUB_TOKEN);

  if (!process.env.LOCAL) {
    githubToken = decryptSecret(process.env.GITHUB_TOKEN);
  }

  return githubToken.then(token => request({
    method: 'POST',
    uri: `${issueUrl}/comments`,
    body: {
      body: `![](${screenshotUrl})`,
      in_reply_to: commentId,
    },
    headers: {
      'User-Agent': 'responsibot',
      Authorization: `token ${token}`,
    },
    json: true,
  }));

const responsibot = (event) => {
  let decryptedSecrets = Promise.resolve([
    process.env.SAUCE_USERNAME,
    process.env.SAUCE_ACCESS_KEY,
  ]);

  if (!process.env.LOCAL) {
    decryptedSecrets = Promise.all([
      decryptSecret(process.env.SAUCE_USERNAME),
      decryptSecret(process.env.SAUCE_ACCESS_KEY),
    ]);
  }

  return decryptedSecrets.then(([SAUCE_USERNAME, SAUCE_ACCESS_KEY]) => {
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

    const url = parseBody(event.comment.body);

    // navigate to url
    const client = webdriverio.remote(wdconf);

    return new Promise((resolve) => {
      return client
        .init()
        .url(url)
        .screenshot()
        .then(base64 => resolve(s3put(base64)))
        .end();
    }).then(screenshotUrl => postToGitHub(screenshotUrl, event.comment.issue_url, event.comment.id));
  });
};

module.exports = {
  handler: (event, context, callback) => responsibot(event)
    .then((screenshot) => {
      callback(null, screenshot);
    })
    .catch(err => callback(err)),
};
