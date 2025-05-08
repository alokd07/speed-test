const { getExecOutput } = require('./api-handlers-helpers');
var os = require('os');


exports.testSpeedHandler = async () => {
    // try {
    const testCommandOutput = await getExecOutput('fast --upload --json')

    //Handle no internet error
    if (testCommandOutput.data == '› Please check your internet connection\n\n\n') {
        testCommandOutput.status = 400
    }

    if (testCommandOutput.status !== 200) {
        return testCommandOutput
    }
    // } catch (err) {
    //     return err
    // }
    console.log('Data before parsing:', testCommandOutput); // Add this line

    return {
        ...testCommandOutput,
        data: {
            ...JSON.parse(testCommandOutput.data),
            server: os.hostname(),
            os: process.platform,
        }
    }
}