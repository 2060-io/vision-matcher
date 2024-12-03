// test/faceMatchEndpoint.test.mjs
import request from 'supertest';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { describe, it, before } from 'mocha';
import app from '../server.js';

// Utility function to convert a file to base64
function convertImageToBase64(imagePath) {
  const fileContent = fs.readFileSync(imagePath);
  return fileContent.toString('base64');
}

// Helper function to add delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('POST /face_match', function () {
  this.timeout(60000); //Timeout of 60 seconds for the model to be loaded
  
  let image1Base64;
  let image2Base64;
  let image3Base64;

  let image1Path;
  let image2Path;
  let image3Path;

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

    // Convert images to base64
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    image1Path = path.join(__dirname, 'assets/angelina1.jpeg');
    image2Path = path.join(__dirname, 'assets/angelina2.jpeg');
    image3Path = path.join(__dirname, 'assets/salma.jpeg');

    try {
      image1Base64 = convertImageToBase64(image1Path);
      image2Base64 = convertImageToBase64(image2Path);
      image3Base64 = convertImageToBase64(image3Path);
    } catch (err) {
      console.error("Error reading images:", err);
      done(err);
    }
  });

  // Test if image extension is missing
  it('should return 400 if image extension is missing or invalid', function (done) {
    request(app)
      .post('/face_match')
      .send({ image1_base64: 'sample_base64_data', image2_base64: 'sample_base64_data' })
      .expect(400, done);
  });

  // Test if image path does not exists
  it('should return 400 if image path does not exist', function (done) {
    const nonExistentPath = './non_existent_image.jpg';

    request(app)
      .post('/face_match')
      .send({ image1_path: nonExistentPath, image2_path: nonExistentPath })
      .expect(400, done);
  });

  // Test using the base64 images
  it('should perform a valid face match with two images', function (done) {
    request(app)
      .post('/face_match')
      .send({
        image1_base64: image1Base64,
        image2_base64: image2Base64,
        image1Base64Extension: 'jpeg',
        image2Base64Extension: 'jpeg'
      })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        // Additional assertions can be made on res.body
        done();
      });
  });

  // Test with images of the same person in base64
  it('should perform a valid face match with image1 and image2 (distance < 0.4)', function (done) {
    request(app)
      .post('/face_match')
      .send({
        image1_base64: image1Base64,
        image2_base64: image2Base64,
        image1Base64Extension: 'jpeg',
        image2Base64Extension: 'jpeg'
      })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('distance').that.is.lessThan(0.4);
        expect(res.body).to.have.property('requestId').that.is.a('number');
        expect(res.body).to.have.property('match').that.is.true;
        done();
      });
  });

  // Test images of different people base64
  it('should perform a valid face match with image1 and image3 (distance > 0.4)', function (done) {
    request(app)
      .post('/face_match')
      .send({
        image1_base64: image1Base64,
        image2_base64: image3Base64,
        image1Base64Extension: 'jpeg',
        image2Base64Extension: 'jpeg'
      })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('distance').that.is.greaterThan(0.4);
        expect(res.body).to.have.property('requestId').that.is.a('number');
        expect(res.body).to.have.property('match').that.is.false;
        done();
      });
  });

  // Test with image paths of the same person
  it('should perform a valid face match with image1_path and image2_path (distance < 0.4)', function (done) {
    request(app)
      .post('/face_match')
      .send({ image1_path: image1Path, image2_path: image2Path })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('distance').that.is.lessThan(0.4);
        expect(res.body).to.have.property('requestId').that.is.a('number');
        expect(res.body).to.have.property('match').that.is.true;
        done();
      });
  });

  // Test with image paths of the diferent people
  it('should perform a valid face match with image1_path and image2_path (distance < 0.4)', function (done) {
    request(app)
      .post('/face_match')
      .send({ image1_path: image1Path, image2_path: image3Path })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('distance').that.is.greaterThan(0.4);
        expect(res.body).to.have.property('requestId').that.is.a('number');
        expect(res.body).to.have.property('match').that.is.false;
        done();
      });
  });

  // Test parallel requests
  it('should perform valid face matches in parallel and log request times', async function () {
    const tasks = [];

    // Preparing requests
    const requests = [
      { image1_base64: image1Base64, image2_base64: image2Base64, expectedDistance: '<0.4' },
      { image1_base64: image1Base64, image2_base64: image3Base64, expectedDistance: '>0.4' },
      { image1_base64: image1Base64, image2_base64: image2Base64, expectedDistance: '<0.4' },
      { image1_base64: image1Base64, image2_base64: image3Base64, expectedDistance: '>0.4' },
      { image1_base64: image1Base64, image2_base64: image2Base64, expectedDistance: '<0.4' },
    ];

    // Creating requests with a delay
    for (let i = 0; i < requests.length; i++) {
      tasks.push(
        delay(i * 50).then(async () => {
          const startTime = Date.now();

          await request(app)
            .post('/face_match')
            .send({
              image1_base64: requests[i].image1_base64,
              image2_base64: requests[i].image2_base64,
              image1Base64Extension: 'jpeg',
              image2Base64Extension: 'jpeg'
            })
            .expect(200)
            .then(res => {
              const endTime = Date.now();
              const timeTaken = endTime - startTime;
              console.log(`Request ${i+1} took ${timeTaken} ms`);

              const distance = res.body.distance;
              const match = res.body.match;
              if (requests[i].expectedDistance === '<0.4') {
                expect(distance).to.be.lessThan(0.4);
                expect(match).to.be.true;
              } else {
                expect(distance).to.be.greaterThan(0.4);
                expect(match).to.be.false;
              }
              expect(res.body).to.have.property('requestId').that.is.a('number');
            });
        })
      );
    }

    // Execute all requests in parallel
    await Promise.all(tasks);
  });
});