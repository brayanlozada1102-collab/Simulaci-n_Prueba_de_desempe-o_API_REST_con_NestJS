import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { RequestStatus } from '../src/requests/entities/request.entity.js';

describe('Commercial Requests API (e2e) - Acceptance Criteria', () => {
  let app: INestApplication;
  const apiKey1 = 'clave_secreta_comercial_1';
  const apiKey2 = 'clave_secreta_comercial_2';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Criteria 1, 2 and 3: Security of x-api-key and x-user', () => {
    it('Criterion 1: Rejects request without x-api-key with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-user', 'admin')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toContain('x-api-key');
    });

    it('Criterion 2: Rejects request with invalid x-api-key with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', 'invalid_fake_key')
        .set('x-user', 'admin')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toContain('Invalid');
    });

    it('Rejects request with non-existent user in memory with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'ghost_user')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
    });

    it('Criterion 3: Two distinct configured API keys allow consuming the API', async () => {
      // Key 1
      const res1 = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(200);
      expect(res1.body.success).toBe(true);

      // Key 2
      const res2 = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey2)
        .set('x-user', 'admin')
        .expect(200);
      expect(res2.body.success).toBe(true);
    });
  });

  describe('Criterion 4: DTO Validation', () => {
    it('Rejects request creation with missing or empty client with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          client: '',
          description: 'Interested in quotation',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('client');
    });

    it('Rejects request creation with empty description with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          client: 'Acme Corp',
          description: '',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('Rejects non-whitelisted fields in DTO (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          client: 'Acme Corp',
          description: 'Valid description',
          unwantedProperty: 'hack',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });
  });

  describe('Criteria 5, 6, 7 and 8: TypeORM, BR-01, BR-02 and BR-03', () => {
    let requestIdJohn: number;
    let requestIdMary: number;

    it('Criterion 5 & BR-01: Stores record in TypeORM with PENDING initial status and assigns own advisor', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          client: 'Alpha Corporation',
          description: 'Accounting software quotation',
        })
        .expect(201);

      // Criterion 9: Standardized response format
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.client).toBe('Alpha Corporation');
      expect(res.body.data.status).toBe(RequestStatus.PENDING);
      expect(res.body.data.advisor).toBe('advisor_john');

      requestIdJohn = res.body.data.id;
    });

    it('Creates request for advisor_mary', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_mary')
        .send({
          client: 'Beta Industries',
          description: 'Cybersecurity consulting',
        })
        .expect(201);

      expect(res.body.data.advisor).toBe('advisor_mary');
      requestIdMary = res.body.data.id;
    });

    it('Criterion 6: Advisor can only retrieve their own requests in the list', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .expect(200);

      expect(res.body.success).toBe(true);
      const list = res.body.data;
      expect(Array.isArray(list)).toBe(true);
      const otherAdvisorRequests = list.filter((r: any) => r.advisor !== 'advisor_john');
      expect(otherAdvisorRequests).toHaveLength(0);
    });

    it('Criterion 6: Advisor can retrieve own individual request', async () => {
      const res = await request(app.getHttpServer())
        .get(`/requests/${requestIdJohn}`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .expect(200);

      expect(res.body.data.id).toBe(requestIdJohn);
    });

    it('Criterion 6: Advisor is rejected with 403 when retrieving another advisor request', async () => {
      const res = await request(app.getHttpServer())
        .get(`/requests/${requestIdMary}`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
    });

    it('Admin can retrieve all requests without restriction', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(200);

      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((r: any) => r.id);
      expect(ids).toContain(requestIdJohn);
      expect(ids).toContain(requestIdMary);
    });

    it('Criterion 7: Advisor cannot change status of another advisor request (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/requests/${requestIdMary}/status`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({ status: RequestStatus.IN_PROGRESS })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
    });

    it('Criterion 8: Rejects direct transition from PENDING to RESOLVED with 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/requests/${requestIdJohn}/status`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({ status: RequestStatus.RESOLVED })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain('directly');
    });

    it('Allows valid transition from PENDING to IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/requests/${requestIdJohn}/status`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({ status: RequestStatus.IN_PROGRESS })
        .expect(200);

      expect(res.body.data.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('Allows valid transition from IN_PROGRESS to RESOLVED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/requests/${requestIdJohn}/status`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({ status: RequestStatus.RESOLVED })
        .expect(200);

      expect(res.body.data.status).toBe(RequestStatus.RESOLVED);
    });

    it('Criterion 8: Rejects reopening or modifying a RESOLVED request with 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/requests/${requestIdJohn}/status`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({ status: RequestStatus.IN_PROGRESS })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain('RESOLVED');
    });

    it('Supervisor can change status of any advisor request', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/requests/${requestIdMary}/status`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({ status: RequestStatus.IN_PROGRESS })
        .expect(200);

      expect(res.body.data.status).toBe(RequestStatus.IN_PROGRESS);
    });
  });

  describe('Criteria 9 and 10: Interceptor and Exception Filter', () => {
    it('Criterion 9: Successful responses contain { success: true, data: ... }', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });

    it('Criterion 10: Errors contain { success: false, statusCode, message, timestamp, path }', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests/999999')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('statusCode', 404);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('path', '/requests/999999');
    });
  });

  describe('Spanish route aliases compatibility (/solicitudes and :id/estado)', () => {
    it('Allows querying via /solicitudes route alias', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
