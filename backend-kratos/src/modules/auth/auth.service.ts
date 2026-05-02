import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Athlete } from "../../entities/athlete.entity";
@Injectable()
export class AuthService {
  constructor(@InjectRepository(Athlete) private readonly repo: Repository<Athlete>, private readonly jwt: JwtService) {}
  async register(dto: any) {
    const ex = await this.repo.findOneBy({email:dto.email});
    if(ex) throw new ConflictException("Email ja cadastrado");
    const a = this.repo.create({name:dto.name,email:dto.email,birthDate:new Date(dto.birthDate),biometricHash:dto.biometricHash,phone:dto.phone,position:dto.position,isMinor:dto.isMinor||false,parentId:dto.parentId});
    const s = await this.repo.save(a);
    return this.build(s);
  }
  async login(dto: any) {
    const a = await this.repo.findOneBy({email:dto.email});
    if(!a || a.biometricHash !== dto.biometricHash) throw new UnauthorizedException("Credenciais invalidas");
    return this.build(a);
  }
  async validateById(id: string) { return this.repo.findOneBy({id}); }
  private build(a: Athlete) {
    return { accessToken:this.jwt.sign({sub:a.id,email:a.email}), athlete:{id:a.id,name:a.name,email:a.email,eloComposite:Math.round(a.eloH*0.5+a.eloC*0.3+a.eloZ*0.2),isCaptain:a.isCaptain,isMinor:a.isMinor} };
  }
}