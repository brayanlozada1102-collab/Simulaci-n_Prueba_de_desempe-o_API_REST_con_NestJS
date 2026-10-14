import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { RequestStatus } from '../src/requests/entities/request.entity.js';

describe('Commercial Requests API (e2e) - Parte 1 & Parte 2', () => {
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

  describe('Security & Authentication (x-api-key and x-user)', () => {
    it('Rejects request without x-api-key with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-user', 'admin')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toContain('x-api-key');
    });

    it('Rejects request with invalid x-api-key with 401', async () => {
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

    it('Two distinct configured API keys allow consuming the API', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(200);
      expect(res1.body.success).toBe(true);

      const res2 = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey2)
        .set('x-user', 'admin')
        .expect(200);
      expect(res2.body.success).toBe(true);
    });
  });

  describe('DTO Validation and Text Normalization (RN-11)', () => {
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
    });

    it('Rejects request creation with only spaces in client with 400 (RN-11)', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          client: '     ',
          description: 'Interested in quotation',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
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

  describe('Core Requests Lifecycle, TypeORM, and Audit History', () => {
    let requestIdJohn: number;
    let requestIdMary: number;
    let requestIdSupervisor: number;

    it('BR-01 & RN-09: Stores record in TypeORM with PENDING initial status and assigns own advisor', async () => {
      const res = await request(app.getHttpServer())
        .post('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          client: 'Alpha Corporation',
          description: 'Accounting software quotation',
        })
        .expect(201);

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

    it('Escenario 12: Creación por un supervisor queda sin asesor y con evento CREACION', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({
          cliente: 'Ferretería El Norte',
          descripcion: 'Coordinar visita de seguimiento',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(RequestStatus.PENDING);
      expect(res.body.data.advisor).toBeNull();
      requestIdSupervisor = res.body.data.id;

      // Verify CREACION history event
      const historyRes = await request(app.getHttpServer())
        .get(`/solicitudes/${requestIdSupervisor}/historial`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .expect(200);

      expect(historyRes.body.success).toBe(true);
      expect(historyRes.body.data).toHaveLength(1);
      expect(historyRes.body.data[0].tipoEvento).toBe('CREACION');
      expect(historyRes.body.data[0].valorNuevo).toBe('PENDIENTE');
      expect(historyRes.body.data[0].usuarioActor).toBe('supervisor');
    });

    it('RN-08: Advisor can only retrieve their own requests in paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/requests')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      const list = res.body.data.items;
      expect(Array.isArray(list)).toBe(true);
      const otherAdvisorRequests = list.filter((r: any) => r.advisor !== 'advisor_john');
      expect(otherAdvisorRequests).toHaveLength(0);
    });

    it('Advisor can retrieve own individual request', async () => {
      const res = await request(app.getHttpServer())
        .get(`/requests/${requestIdJohn}`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .expect(200);

      expect(res.body.data.id).toBe(requestIdJohn);
    });

    it('Advisor is rejected with 403 when retrieving another advisor request', async () => {
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
      const ids = res.body.data.items.map((r: any) => r.id);
      expect(ids).toContain(requestIdJohn);
      expect(ids).toContain(requestIdMary);
    });

    it('Advisor cannot change status of another advisor request (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/requests/${requestIdMary}/status`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({ status: RequestStatus.IN_PROGRESS })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
    });

    it('Rejects direct transition from PENDING to RESOLVED with 400', async () => {
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

    it('Rejects reopening or modifying a RESOLVED request with 400', async () => {
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
  });

  describe('RN-07: Asignación de solicitudes', () => {
    let unassignedReqId: number;
    let resolvedReqId: number;

    beforeAll(async () => {
      // Create an unassigned request by supervisor
      const res1 = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({
          cliente: 'Industrias Bogota',
          descripcion: 'Cotización de hosting',
        })
        .expect(201);
      unassignedReqId = res1.body.data.id;

      // Create and resolve another request
      const res2 = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          cliente: 'Empresa Terminada',
          descripcion: 'Completada',
        })
        .expect(201);
      resolvedReqId = res2.body.data.id;

      await request(app.getHttpServer())
        .patch(`/solicitudes/${resolvedReqId}/estado`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({ estado: 'EN_GESTION' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/solicitudes/${resolvedReqId}/estado`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({ estado: 'RESUELTA' })
        .expect(200);
    });

    it('Escenario 01: Supervisor asigna una solicitud a un asesor existente (asesor02)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/solicitudes/${unassignedReqId}/asignacion`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({
          asesorId: 'asesor02',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.advisor).toBe('asesor02');

      // Verify ASIGNACION event in history
      const histRes = await request(app.getHttpServer())
        .get(`/solicitudes/${unassignedReqId}/historial`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .expect(200);

      const asignacionEvents = histRes.body.data.filter(
        (e: any) => e.tipoEvento === 'ASIGNACION',
      );
      expect(asignacionEvents).toHaveLength(1);
      expect(asignacionEvents[0].valorNuevo).toBe('asesor02');
      expect(asignacionEvents[0].usuarioActor).toBe('supervisor');
    });

    it('Escenario 02: Asignación inválida a usuario inexistente o no asesor se rechaza con 400', async () => {
      // Inexistent user
      const res1 = await request(app.getHttpServer())
        .patch(`/solicitudes/${unassignedReqId}/asignacion`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({
          asesorId: 'usuario_inexistente',
        })
        .expect(400);

      expect(res1.body.success).toBe(false);

      // User with role supervisor or admin
      const res2 = await request(app.getHttpServer())
        .patch(`/solicitudes/${unassignedReqId}/asignacion`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({
          asesorId: 'admin',
        })
        .expect(400);

      expect(res2.body.success).toBe(false);
    });

    it('Escenario 03: Intento de reasignación por un asesor es rechazado con 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/solicitudes/${unassignedReqId}/asignacion`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          asesorId: 'asesor02',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
    });

    it('Escenario 04: Reasignación de una solicitud resuelta es rechazada con 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/solicitudes/${resolvedReqId}/asignacion`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'supervisor')
        .send({
          asesorId: 'asesor02',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
    });
  });

  describe('RN-08: Consulta con filtros y paginación', () => {
    it('Escenario 05: Un asesor consulta con asesor=otro_usuario y solo recibe sus propias solicitudes', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes?asesor=advisor_mary')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .expect(200);

      expect(res.body.success).toBe(true);
      const items = res.body.data.items;
      items.forEach((item: any) => {
        expect(item.advisor).toBe('advisor_john');
      });
    });

    it('Escenario 06: Paginación inválida (page=0, limit=-1 o limit=1000) rechaza con 400', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes?page=0')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(400);

      await request(app.getHttpServer())
        .get('/solicitudes?limit=-1')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(400);

      await request(app.getHttpServer())
        .get('/solicitudes?limit=1000')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(400);

      await request(app.getHttpServer())
        .get('/solicitudes?limit=abc')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(400);
    });

    it('Escenario 07: Intervalo de fechas inválido (desde posterior a hasta) rechaza con 400', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/solicitudes?desde=2026-12-31T00:00:00Z&hasta=2026-01-01T00:00:00Z',
        )
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('Filters requests by cliente (case-insensitive partial match)', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes?cliente=ferreter')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.items[0].client.toLowerCase(),
      ).toContain('ferreter');
    });

    it('Includes items and pagination metadata in response', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes?page=1&limit=5')
        .set('x-api-key', apiKey1)
        .set('x-user', 'admin')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 5,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      );
    });
  });

  describe('RN-09 & RN-10: Auditoría y Concurrencia', () => {
    let testReqId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          cliente: 'Empresa Concurrencia',
          descripcion: 'Prueba de versiones',
        })
        .expect(201);
      testReqId = res.body.data.id;
    });

    it('Escenario 11: Asesor recibe 403 al intentar consultar historial de solicitud ajena', async () => {
      // advisor_mary tries to view history of advisor_john's request
      const res = await request(app.getHttpServer())
        .get(`/solicitudes/${testReqId}/historial`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_mary')
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(403);
    });

    it('Escenario 08: Cambio de estado con versión esperada vigente actualiza estado, versión e historial', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/solicitudes/${testReqId}/estado`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          estado: 'EN_GESTION',
          versionEsperada: 1,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(RequestStatus.IN_PROGRESS);
      expect(res.body.data.version).toBe(2);

      // Verify ESTADO event in history
      const histRes = await request(app.getHttpServer())
        .get(`/solicitudes/${testReqId}/historial`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .expect(200);

      const events = histRes.body.data;
      const estadoEvent = events.find((e: any) => e.tipoEvento === 'ESTADO');
      expect(estadoEvent).toBeDefined();
      expect(estadoEvent.valorAnterior).toBe('PENDIENTE');
      expect(estadoEvent.valorNuevo).toBe('EN_GESTION');
      expect(estadoEvent.usuarioActor).toBe('advisor_john');
    });

    it('Escenario 09: Cambio de estado con versión desactualizada rechaza con 409 Conflict', async () => {
      // Request is now version 2, sending versionEsperada 1 should fail
      const res = await request(app.getHttpServer())
        .patch(`/solicitudes/${testReqId}/estado`)
        .set('x-api-key', apiKey1)
        .set('x-user', 'advisor_john')
        .send({
          estado: 'RESUELTA',
          versionEsperada: 1,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.message).toContain('otro usuario');
    });
  });
});
