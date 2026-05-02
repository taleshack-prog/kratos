import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Athlete } from "../../entities/athlete.entity";
@Injectable()
export class AthletesService {
  constructor(@InjectRepository(Athlete) private readonly repo: Repository<Athlete>) {}
  async findById(id: string) {
    const a = await this.repo.findOneBy({id});
    if(!a) throw new NotFoundException("Atleta nao encontrado");
    return a;
  }
  async findProfile(id: string) {
    const a = await this.findById(id);
    return { id:a.id, name:a.name, email:a.email, position:a.position, isMinor:a.isMinor, isCaptain:a.isCaptain, eloH:a.eloH, eloC:a.eloC, eloZ:a.eloZ, eloComposite:Math.round(a.eloH*0.5+a.eloC*0.3+a.eloZ*0.2), reputationScore:a.reputationScore };
  }
  async getRanking(limit=20) {
    return this.repo.createQueryBuilder("a").select(["a.id","a.name","a.position","a.isCaptain","a.eloH","a.eloC","a.eloZ"]).addSelect("(a.eloH*0.5+a.eloC*0.3+a.eloZ*0.2)","eloComposite").orderBy("eloComposite","DESC").limit(limit).getRawMany();
  }
  async getDependents(parentId: string) { return this.repo.findBy({parentId}); }
}