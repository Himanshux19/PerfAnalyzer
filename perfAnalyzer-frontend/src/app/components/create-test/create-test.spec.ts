import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateTest } from './create-test';

describe('CreateTest', () => {
  let component: CreateTest;
  let fixture: ComponentFixture<CreateTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateTest],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateTest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
