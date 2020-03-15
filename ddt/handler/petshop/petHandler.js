var chakram = require('chakram'),
  expect = chakram.expect;

function validate(r) {
  return expect(r)
    .to.have.json('photoUrls', function (featureArray) {
      expect(featureArray, "Wrong photo urls")
        .to.deep.equal([
        "url1",
        "url2"
      ]);
    });
}

module.exports = {
  validate: validate
}
