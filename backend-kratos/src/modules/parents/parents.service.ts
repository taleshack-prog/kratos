import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
@Injectable()
export class ParentsService {
  constructor(private readonly dataSource: DataSource) {}
  async getPending(parentId: string) {
    return this.dataSource.query(
      "SELECT pa.*,a.name AS minor_name,ms.modality,ms.scheduled_start,c.name AS court_name FROM parent_authorizations pa JOIN athletes a ON a.id=pa.minor_id JOIN match_scheduling ms ON ms.id=pa.match_id JOIN courts c ON c.id=ms.court_id WHERE pa.parent_id=$1 AND pa.status='pending' ORDER BY pa.notified_at DESC",
      [parentId]);
  }
  async respond(authId: string, parentId: string, status: string) {
    const r = await this.dataSource.query("SELECT * FROM parent_authorizations WHERE id=$1",[authId]);
    if(r[0].parent_id !== parentId) throw new ForbiddenException("Acesso negado");
    await this.dataSource.query("UPDATE parent_authorizations SET status=$1,responded_at=CURRENT_TIMESTAMP WHERE id=$2",[status,authId]);
    return { message: "Autorização " + status };
  }
}