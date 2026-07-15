import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as OTPAuth from 'otplib';
import * as qrcode from 'qrcode';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

jest.mock('bcrypt');
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  verify: jest.fn(),
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockPrisma = {
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  describe('registerTenant', () => {
    const dto = {
      schoolName: 'École Test',
      adminEmail: 'admin@test.com',
      adminFirstName: 'Jean',
      adminLastName: 'Dupont',
      adminPassword: 'password123',
    };

    it('devrait créer un établissement avec succès', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const mockTenant = { id: 'tenant-1', name: dto.schoolName };
      const mockUser = { id: 'user-1', email: dto.adminEmail };

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          tenant: { create: jest.fn().mockResolvedValue(mockTenant) },
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          academicYear: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.registerTenant(dto);

      expect(result).toEqual({ tenantId: 'tenant-1', message: 'Établissement créé avec succès' });
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({ where: { email: dto.adminEmail } });
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.adminPassword, 12);
    });

    it('devrait lever ConflictException si l\'email existe déjà', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });
      await expect(service.registerTenant(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = { email: 'admin@test.com', password: 'password123' };
    const mockUser = {
      id: 'user-1',
      email: 'admin@test.com',
      passwordHash: 'hashed-password',
      isActive: true,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      role: 'ADMIN',
      tenantId: 'tenant-1',
      firstName: 'Jean',
      lastName: 'Dupont',
      tenant: { id: 'tenant-1', status: 'ACTIVE' },
    };

    it('devrait connecter un utilisateur avec succès', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken', 'mock-token');
      expect(result.user).toMatchObject({ id: 'user-1', email: 'admin@test.com', role: 'ADMIN' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastLoginAt: expect.any(Date) }) }),
      );
    });

    it('devrait lever UnauthorizedException pour email/mot de passe incorrect', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever UnauthorizedException pour compte désactivé', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever UnauthorizedException pour établissement suspendu', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        tenant: { ...mockUser.tenant, status: 'SUSPENDED' },
      });
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever UnauthorizedException pour mot de passe incorrect', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('devrait retourner requiresTwoFactor si 2FA est activé', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'secret' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ ...loginDto, twoFactorCode: undefined });
      expect(result).toEqual({ requiresTwoFactor: true, userId: 'user-1' });
    });

    it('devrait valider le code 2FA et connecter', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'secret' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (OTPAuth.verify as jest.Mock).mockReturnValue(true);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.login({ ...loginDto, twoFactorCode: '123456' });
      expect(result).toHaveProperty('accessToken');
      expect(OTPAuth.verify).toHaveBeenCalledWith({ token: '123456', secret: 'secret' });
    });

    it('devrait lever UnauthorizedException pour code 2FA invalide', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'secret' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (OTPAuth.verify as jest.Mock).mockReturnValue(false);

      await expect(service.login({ ...loginDto, twoFactorCode: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('devrait retourner de nouveaux tokens avec un refreshToken valide', async () => {
      const payload = { sub: 'user-1', email: 'admin@test.com', role: 'ADMIN', tenantId: 'tenant-1' };
      const mockUser = {
        id: 'user-1',
        email: 'admin@test.com',
        refreshToken: 'hashed-refresh-token',
        role: 'ADMIN',
        tenantId: 'tenant-1',
        firstName: 'Jean',
        lastName: 'Dupont',
      };

      mockJwtService.verify.mockReturnValue(payload);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('new-token');

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken', 'new-token');
      expect(result).toHaveProperty('refreshToken', 'new-token');
    });

    it('devrait lever UnauthorizedException pour un refreshToken invalide', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error(); });
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever UnauthorizedException si le token stocké ne correspond pas', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', refreshToken: 'stored-token' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshTokens('token-mismatch')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('setupTwoFactor', () => {
    it('devrait configurer le 2FA et retourner le secret et le QR code', async () => {
      const user = { id: 'user-1', email: 'admin@test.com' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, twoFactorSecret: 'generated-secret' });
      (OTPAuth.generateSecret as jest.Mock).mockReturnValue('generated-secret');
      (qrcode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,qrcode-data');

      const result = await service.setupTwoFactor('user-1');

      expect(result).toHaveProperty('secret', 'generated-secret');
      expect(result).toHaveProperty('qrCode', 'data:image/png;base64,qrcode-data');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { twoFactorSecret: 'generated-secret' } }),
      );
    });

    it('devrait lever UnauthorizedException si l\'utilisateur n\'existe pas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.setupTwoFactor('invalid-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyTwoFactor', () => {
    it('devrait activer le 2FA avec un code valide', async () => {
      const user = { id: 'user-1', twoFactorSecret: 'secret' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (OTPAuth.verify as jest.Mock).mockReturnValue(true);

      const result = await service.verifyTwoFactor('user-1', '123456');

      expect(result).toEqual({ message: '2FA activé avec succès' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { twoFactorEnabled: true } }),
      );
    });

    it('devrait lever UnauthorizedException pour un code 2FA invalide', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', twoFactorSecret: 'secret' });
      (OTPAuth.verify as jest.Mock).mockReturnValue(false);

      await expect(service.verifyTwoFactor('user-1', 'wrong-code')).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever UnauthorizedException si l\'utilisateur n\'a pas de secret 2FA', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', twoFactorSecret: null });
      await expect(service.verifyTwoFactor('user-1', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });
});
