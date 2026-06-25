import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutionControls } from './execution-controls';

describe('ExecutionControls', () => {
  let component: ExecutionControls;
  let fixture: ComponentFixture<ExecutionControls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutionControls],
    }).compileComponents();

    fixture = TestBed.createComponent(ExecutionControls);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
