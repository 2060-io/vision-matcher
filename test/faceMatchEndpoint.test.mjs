// test/faceMatchEndpoint.test.mjs
import request from 'supertest';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { describe, it, before } from 'mocha';
import app from '../server.js';

describe('POST /face_match', function () {
  before((done) => {
    // Wait until the face_matcher process is ready
    const checkInterval = setInterval(() => {
      request(app)
        .post('/face_match')
        .send({})
        .end((err, res) => {
          if (res.status !== 503) {
            clearInterval(checkInterval);
            done();
          }
        });
    }, 100);
  });

  it('should return 400 if image extension is missing or invalid', function (done) {
    request(app)
      .post('/face_match')
      .send({ image1_base64: 'sample_base64_data', image2_base64: 'sample_base64_data' })
      .expect(400, done);
  });

  it('should return 400 if image path does not exist', function (done) {
    const nonExistentPath = './non_existent_image.jpg';

    request(app)
      .post('/face_match')
      .send({ image1_path: nonExistentPath, image2_path: nonExistentPath })
      .expect(400, done);
  });

  //it('should return 504 if the request times out', function (done) {
  //  this.timeout(15000); // Extend timeout duration for this test

  //  // Mock behavior where the face matcher never responds in time
  //  request(app)
  //    .post('/face_match')
  //    .send({
  //      image1_base64: 'some_base64_encoded_data',
  //      image2_base64: 'other_base64_encoded_data',
  //      image1Base64Extension: 'jpg',
  //      image2Base64Extension: 'jpg'
  //    })
  //    .expect(504, done);
  //});

});