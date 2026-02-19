use crate::domain::rank::entities::Rank;

pub trait RankService: Send + Sync {
    fn initial(&self) -> Rank;
    fn between(&self, before: &Rank, after: &Rank) -> Rank;
    fn after(&self, rank: &Rank) -> Rank;
    fn before(&self, rank: &Rank) -> Rank;
}
