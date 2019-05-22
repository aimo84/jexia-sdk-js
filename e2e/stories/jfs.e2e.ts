import * as faker from 'faker';
import * as fs from 'fs';
import * as Joi from 'joi';
// @ts-ignore
import * as joiAssert from 'joi-assert';
import "reflect-metadata";
import { FilesetRecordSchema } from "../lib/fileset";
import { RTCMessageSchema } from '../lib/rtc';
import { cleaning, initWithJFS, jfs } from "../teardowns";

jest.setTimeout(30000);

const filesetName = 'test';
const testFieldsSchema = {
  stringField: Joi.string().required(),
  booleanField: Joi.boolean().required(),
  numberField: Joi.number().required(),
  objField: Joi.object().required(),
};

beforeAll(async () => await initWithJFS(filesetName));

afterAll(async () => await cleaning());

describe('Fileset Module', () => {

  it('should be able to get fileset name', () => {
    expect(jfs.fileset(filesetName).name).toEqual(filesetName);
  });

  it('should upload a file', (done) => {
    jfs.fileset(filesetName).upload([{
      file: fs.createReadStream('e2e/resources/bee-32x32.png'),
    }]).subscribe((result) => {
      joiAssert(result, FilesetRecordSchema);
      done();
    });
  });

  it('should upload a file with custom fields', (done) => {
    const data = {
      stringField: faker.lorem.sentence(5),
      booleanField: faker.random.boolean(),
      numberField: faker.random.number(),
      objField: {
        email: faker.internet.email()
      }
    };
    const resultExpectation = expect.objectContaining(data);
    jfs.fileset(filesetName).upload([{
      data,
      file: fs.createReadStream('e2e/resources/bee-32x32.png'),
    }]).subscribe((result) => {
      joiAssert(result, FilesetRecordSchema.append(testFieldsSchema));
      expect(result).toEqual(resultExpectation);
      done();
    });
  });

  it('should receive uploading statuses with RTC', (done) => {
    let messagesReceived = 0;
    const subscription = jfs.fileset(filesetName).watch().subscribe(
      (event) => {
        joiAssert(event, RTCMessageSchema, 'incorrect message schema received');
        switch (++messagesReceived) {
          case 1:
            if (event.action !== 'created') {
              finishTest(`first event should have created action, but it has ${event.action}`);
            }
            break;
          case 2:
            if (event.action !== 'updated') {
              finishTest(`second event should have updated action, but it has ${event.action}`);
            }
            break;
          default:
            finishTest('Wrong action received');
        }
        if (messagesReceived === 2) {
          finishTest();
        }
      },
      (error) => {
        done(error);
      },
      () => done('Unexpected RTC error')
    );
    const finishTest = (error?: string) => {
      subscription.unsubscribe();
      done(error);
    };

    jfs.fileset(filesetName).upload([{
      file: fs.createReadStream('e2e/resources/bee-32x32.png'),
    }]).subscribe();
  });

  describe('if subscribeForTheFileUploading config value is set to true', () => {
    beforeAll(() => {
      (jfs as any).config.subscribeForTheFileUploading = true;
    });

    it('should subscribe to the file status automatically and return result when completed', (done) => {
      jfs.fileset(filesetName).upload([{
        file: fs.createReadStream('e2e/resources/bee-32x32.png'),
      }]).subscribe((result) => {
        expect(result.status).toEqual('completed');
        done();
      });
    });
  });

});
