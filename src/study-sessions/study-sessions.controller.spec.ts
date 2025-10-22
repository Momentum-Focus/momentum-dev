import { Test, TestingModule } from '@nestjs/testing';
import { StudySessionsController } from './study-sessions.controller';

describe('StudySessionsController', () => {
  let controller: StudySessionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudySessionsController],
    }).compile();

    controller = module.get<StudySessionsController>(StudySessionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
