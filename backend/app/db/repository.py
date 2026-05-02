from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session
from .models import (
    Conversation,
    KnowledgeNode,
    Message,
    MistakeBook,
    Student,
)

T = TypeVar("T")


# ─── Abstract Repository ────────────────────────────────────────────────


class BaseRepository(ABC, Generic[T]):
    """Repository 抽象基类 —— 切换数据库时只需继承并实现 CRUD。"""

    @abstractmethod
    async def create(self, obj: T) -> T:
        ...

    @abstractmethod
    async def get(self, obj_id: int) -> T | None:
        ...

    @abstractmethod
    async def list(self, **filters: Any) -> Sequence[T]:
        ...

    @abstractmethod
    async def update(self, obj_id: int, **kwargs: Any) -> T | None:
        ...

    @abstractmethod
    async def delete(self, obj_id: int) -> bool:
        ...


# ─── SQLAlchemy Generic Repository ──────────────────────────────────────


class BaseSQLAlchemyRepository(BaseRepository[T]):
    """基于 SQLAlchemy 的通用 Repository 实现。"""

    model_class: type[T]  # 子类必须赋值

    async def create(self, obj: T) -> T:
        async with get_session() as session:
            session.add(obj)
            await session.flush()
            await session.refresh(obj)
            return obj

    async def get(self, obj_id: int) -> T | None:
        async with get_session() as session:
            stmt = select(self.model_class).where(self.model_class.id == obj_id)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()

    async def list(self, **filters: Any) -> Sequence[T]:
        async with get_session() as session:
            stmt = select(self.model_class)
            for attr, value in filters.items():
                column = getattr(self.model_class, attr, None)
                if column is not None:
                    stmt = stmt.where(column == value)
            result = await session.execute(stmt)
            return result.scalars().all()

    async def update(self, obj_id: int, **kwargs: Any) -> T | None:
        async with get_session() as session:
            stmt = (
                update(self.model_class)
                .where(self.model_class.id == obj_id)
                .values(**kwargs)
                .returning(self.model_class)
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.scalar_one_or_none()

    async def delete(self, obj_id: int) -> bool:
        async with get_session() as session:
            stmt = delete(self.model_class).where(self.model_class.id == obj_id)
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0


# ─── Concrete Repositories ──────────────────────────────────────────────


class StudentRepository(BaseSQLAlchemyRepository[Student]):
    model_class = Student

    async def find_by_name(self, name: str) -> Student | None:
        async with get_session() as session:
            stmt = select(Student).where(Student.name == name)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()


class ConversationRepository(BaseSQLAlchemyRepository[Conversation]):
    model_class = Conversation


class MessageRepository(BaseSQLAlchemyRepository[Message]):
    model_class = Message


class MistakeBookRepository(BaseSQLAlchemyRepository[MistakeBook]):
    model_class = MistakeBook


class KnowledgeNodeRepository(BaseSQLAlchemyRepository[KnowledgeNode]):
    model_class = KnowledgeNode
