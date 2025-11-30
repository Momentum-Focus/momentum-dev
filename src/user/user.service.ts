import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';
import { RegisterUserDTO } from './dtos/registerUser.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDTO } from './dtos/updateUser.dto';
import { UpdateProfileDTO } from './dtos/updateProfile.dto';
import { UserRoleService } from 'src/user-role/user-role.service';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private userRoleService: UserRoleService,
    private logsService: LogsService,
  ) {}

  async create(registerUser: RegisterUserDTO): Promise<User | null> {
    const validateEmail = await this.prisma.user.findFirst({
      where: { email: registerUser.email, deletedAt: null },
    });

    if (validateEmail) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com esse email!',
        {
          cause: new Error(),
          description:
            'Já existe um usuário com esse email cadastrado. Faça login ou altere o email!',
        },
      );
    }

    const validatePhone = await this.prisma.user.findFirst({
      where: {
        phone: registerUser.phone,
        deletedAt: null,
      },
    });

    if (validatePhone) {
      throw new ConflictException('Telefone encontrado no banco de dados!', {
        cause: new Error(),
        description: 'Já existe um usuário com esse numero cadastrado.',
      });
    }

    const encrypetedPassword = await bcrypt.hash(registerUser.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        ...registerUser,
        password: encrypetedPassword,
      },
    });

    if (!newUser) {
      throw new BadRequestException('Erro ao criar usuário.', {
        cause: new Error(),
        description:
          'Erro ao inserir o usuário no banco de dados, verifique a conexão com o banco.',
      });
    }

    const { password, createdAt, updatedAt, deletedAt, ...dataNewUser } =
      newUser;

    return dataNewUser as User;
  }

  async update(
    userId: number,
    updateUser: UpdateUserDTO,
  ): Promise<User | null> {
    await this.findUserByID(userId);

    if (updateUser.email) {
      const validateEmail = await this.prisma.user.findFirst({
        where: {
          email: updateUser.email,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validateEmail)
        throw new ConflictException('Email já cadastrado!', {
          cause: new Error(),
          description:
            'Existe um usuário com esse email cadastrado, insira um email diferente e tente novamente!',
        });
    }

    if (updateUser.phone) {
      const validatePhone = await this.prisma.user.findFirst({
        where: {
          phone: updateUser.phone,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validatePhone) {
        throw new ConflictException('Telefone já cadastrado!', {
          cause: new Error(),
          description:
            'Existe um usuário com esse telefone cadastrado, insira um telefone diferente e tente novamente!',
        });
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateUser,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.USER_PROFILE_UPDATE,
      'User profile updated',
    );

    const { password, createdAt, updatedAt, deletedAt, ...dataUserUpdated } =
      updatedUser;

    return dataUserUpdated as User;
  }

  async updateProfile(
    userId: number,
    updateProfileDTO: UpdateProfileDTO,
  ): Promise<User> {
    await this.findUserByID(userId);

    if (updateProfileDTO.email) {
      const validateEmail = await this.prisma.user.findFirst({
        where: {
          email: updateProfileDTO.email,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validateEmail) {
        throw new ConflictException('Email já cadastrado');
      }
    }

    if (updateProfileDTO.phone) {
      const validatePhone = await this.prisma.user.findFirst({
        where: {
          phone: updateProfileDTO.phone,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validatePhone) {
        throw new ConflictException('Telefone já cadastrado');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDTO,
    });

    await this.logsService.createLog(
      userId,
      LogActionType.USER_PROFILE_UPDATE,
      'Profile updated',
    );

    const { password, createdAt, updatedAt, deletedAt, ...userData } =
      updatedUser;

    return userData as User;
  }

  async updateProfileWithCpf(
    userId: number,
    updateData: { phone?: string; cpf?: string },
  ): Promise<User> {
    await this.findUserByID(userId);

    if (updateData.phone) {
      const validatePhone = await this.prisma.user.findFirst({
        where: {
          phone: updateData.phone,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validatePhone) {
        throw new ConflictException('Telefone já cadastrado');
      }
    }

    if (updateData.cpf) {
      const validateCpf = await this.prisma.user.findFirst({
        where: {
          cpf: updateData.cpf,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validateCpf) {
        throw new ConflictException('CPF já cadastrado');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.logsService.createLog(
      userId,
      LogActionType.USER_PROFILE_UPDATE,
      'Profile completed',
    );

    const { password, createdAt, updatedAt, deletedAt, ...userData } =
      updatedUser;

    return userData as User;
  }

  async listUsers(): Promise<User[] | []> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
    });

    return users.map((user) => {
      const { password, ...datasUsers } = user;

      return datasUsers as User;
    });
  }

  async findUserByID(userId: number): Promise<User> {
    const validateUser = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!validateUser)
      throw new NotFoundException('ID inválido!', {
        cause: new Error(),
        description: 'Nenhum usuario encontrado com esse ID, insira outro',
      });

    const { password, createdAt, updatedAt, deletedAt, ...data } = validateUser;

    return data as User;
  }

  async findByIdWithRoles(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user)
      throw new NotFoundException('ID inválido.', {
        cause: new Error(),
        description:
          'Usuário não encontrado, id inválido, verifique e tente novamente.',
      });

    return user;
  }

  async findUserByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const validateEmail = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!validateEmail) return null;

    if (includePassword) return validateEmail as User;

    const { password, createdAt, updatedAt, deletedAt, ...data } =
      validateEmail;

    return data as User;
  }

  async deleteMyAccount(userId: number): Promise<{ message: string }> {
    await this.findUserByID(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    await this.userRoleService.deleteUserRolesByUserId(userId);

    await this.logsService.createLog(
      userId,
      LogActionType.USER_DELETE_ACCOUNT,
      'Account soft-deleted',
    );

    return { message: 'Usuário deletado com sucesso!' };
  }

  async updateSpotifyTokens(
    userId: number,
    accessToken: string,
    refreshToken: string,
    spotifyProduct?: string | null,
  ): Promise<User> {
    console.log('[UserService] updateSpotifyTokens chamado:', {
      userId,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      spotifyProduct,
    });

    // Verifica se userId é um número válido
    if (typeof userId !== 'number' || isNaN(userId)) {
      throw new Error(`userId inválido: ${userId} (tipo: ${typeof userId})`);
    }

    await this.findUserByID(userId);
    console.log('[UserService] Usuário encontrado, atualizando tokens...');

    const updateData: any = {
      spotifyAccessToken: accessToken,
      spotifyRefreshToken: refreshToken,
      isSpotifyConnected: true,
      // Permite conexões simultâneas - não desconecta o YouTube Music
    };

    // Só atualiza spotifyProduct se foi fornecido
    // IMPORTANTE: null é um valor válido (significa que não foi possível determinar)
    // Mas se for uma string vazia, não atualiza
    if (spotifyProduct !== undefined) {
      updateData.spotifyProduct = spotifyProduct;
    }

    console.log('[UserService] Dados para atualizar:', {
      hasAccessToken: !!updateData.spotifyAccessToken,
      hasRefreshToken: !!updateData.spotifyRefreshToken,
      isSpotifyConnected: updateData.isSpotifyConnected,
      spotifyProduct: updateData.spotifyProduct,
    });

    console.log('[UserService] Executando update no Prisma...');
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    console.log('[UserService] Update do Prisma concluído');

    console.log('[UserService] Tokens atualizados com sucesso:', {
      userId: updatedUser.id,
      isSpotifyConnected: updatedUser.isSpotifyConnected,
      hasAccessToken: !!updatedUser.spotifyAccessToken,
      hasRefreshToken: !!updatedUser.spotifyRefreshToken,
      spotifyProduct: updatedUser.spotifyProduct,
    });

    // Força uma nova leitura do banco para garantir que os dados foram persistidos
    console.log('[UserService] Verificando persistência no banco...');
    const verificationUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isSpotifyConnected: true,
        spotifyAccessToken: true,
        spotifyRefreshToken: true,
        spotifyProduct: true,
      },
    });
    console.log('[UserService] Verificação pós-update:', {
      isSpotifyConnected: verificationUser?.isSpotifyConnected,
      hasAccessToken: !!verificationUser?.spotifyAccessToken,
      hasRefreshToken: !!verificationUser?.spotifyRefreshToken,
    });

    const { password, createdAt, updatedAt, deletedAt, ...dataUserUpdated } =
      updatedUser;

    return dataUserUpdated as User;
  }

  async updateGoogleTokens(
    userId: number,
    accessToken: string,
    refreshToken: string | null,
  ): Promise<User> {
    await this.findUserByID(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
        isGoogleConnected: true,
        // Permite conexões simultâneas - não desconecta o Spotify
      },
    });

    const { password, createdAt, updatedAt, deletedAt, ...dataUserUpdated } =
      updatedUser;

    return dataUserUpdated as User;
  }

  async disconnectSpotify(userId: number): Promise<User> {
    await this.findUserByID(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        spotifyAccessToken: null,
        spotifyRefreshToken: null,
        isSpotifyConnected: false,
      },
    });

    const { password, createdAt, updatedAt, deletedAt, ...dataUserUpdated } =
      updatedUser;

    return dataUserUpdated as User;
  }

  async disconnectGoogle(userId: number): Promise<User> {
    await this.findUserByID(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        isGoogleConnected: false,
      },
    });

    const { password, createdAt, updatedAt, deletedAt, ...dataUserUpdated } =
      updatedUser;

    return dataUserUpdated as User;
  }
}
