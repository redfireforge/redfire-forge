import {
  GRPC_DEMO_DOCKER_COMMAND,
  GRPC_DEMO_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_TARGET,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_STUDIO_LESSON_ALLOWED_TABS as GRPC_STUDIO_LESSON_ALLOWED_TABS_VALUES,
} from '../../../adapters';
import { GRPC } from '@shared/selectors';
import {
  getGrpcLessonRunFlags,
  setGrpcLessonRunFlag,
} from '../grpc-lesson-contract/runtime';

export {
  GRPC_DEMO_TARGET,
  GRPC_DEMO_HEALTH_URL,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_DOCKER_COMMAND,
};

/** Re-export so lesson modules can import session flags via the helpers barrel. */
export { setGrpcLessonRunFlag } from '../grpc-lesson-contract/runtime';

export const GRPC_STUDIO_LESSON_ALLOWED_TABS = GRPC_STUDIO_LESSON_ALLOWED_TABS_VALUES;

export const GRPC_ECHO_SERVICE = 'echo.EchoService';
export const GRPC_ECHO_METHOD = 'Echo';
export const GRPC_DEMO_MESSAGE = 'Hello from gRPC Studio';

export const GRPC_ECHO_SERVICE_SEL = GRPC.SERVICE(GRPC_ECHO_SERVICE);
export const GRPC_ECHO_METHOD_SEL = GRPC.METHOD(GRPC_ECHO_SERVICE, GRPC_ECHO_METHOD);

export const grpcLessonSession = {
  get targetSet() {
    return getGrpcLessonRunFlags().targetSet;
  },
  get reflected() {
    return getGrpcLessonRunFlags().reflected;
  },
  get methodSelected() {
    return getGrpcLessonRunFlags().methodSelected;
  },
  get messageFilled() {
    return getGrpcLessonRunFlags().messageFilled;
  },
  get executed() {
    return getGrpcLessonRunFlags().executed;
  },
};

export function resetGrpcLessonSessionFlags(): void {
  setGrpcLessonRunFlag('targetSet', false);
  setGrpcLessonRunFlag('reflected', false);
  setGrpcLessonRunFlag('methodSelected', false);
  setGrpcLessonRunFlag('messageFilled', false);
  setGrpcLessonRunFlag('executed', false);
}
