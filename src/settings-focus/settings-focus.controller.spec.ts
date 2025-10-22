import { Test, TestingModule } from '@nestjs/testing';
import { SettingsFocusController } from './settings-focus.controller';

describe('SettingsFocusController', () => {
  let controller: SettingsFocusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsFocusController],
    }).compile();

    controller = module.get<SettingsFocusController>(SettingsFocusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
